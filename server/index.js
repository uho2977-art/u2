import express from 'express'
import { exec } from 'child_process'
import { promisify } from 'util'
import ping from 'ping'
import os from 'os'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const execAsync = promisify(exec)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ==================== 配置 ====================
const CONFIG = {
  port: process.env.PORT || 3001,
  pollInterval: 120000, // 120秒
  pingHosts: [
    { name: 'GitHub', host: 'github.com' },
    { name: 'YouTube', host: 'youtube.com' },
    { name: 'Telegram', host: 'telegram.org' },
    { name: 'Google', host: 'google.com' }
  ]
}

// ==================== 单一内存缓存 ====================
let cache = {
  gateway: { connected: false, uptime: 0, version: 'N/A' },
  agents: { total: 0, active: 0, list: [] },
  system: { cpu: 0, memory: 0, platform: process.platform, nodeVersion: process.version },
  network: {},
  logs: [],
  errors: 0,
  lastUpdated: null
}

// ==================== 系统监控 ====================
async function getSystemStats() {
  // CPU 使用率
  const cpus = os.cpus()
  let totalIdle = 0
  let totalTick = 0
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type]
    }
    totalIdle += cpu.times.idle
  }
  const cpuUsage = 100 - (totalIdle / totalTick * 100)

  // 内存使用率（macOS 用 memory_pressure，其他系统用 os.freemem）
  let memUsage = 0
  try {
    if (process.platform === 'darwin') {
      // macOS: 使用 memory_pressure 命令获取真实内存压力
      const { stdout } = await execAsync('memory_pressure', { timeout: 2000 })
      const match = stdout.match(/System-wide memory free percentage:\s*(\d+)/)
      if (match) {
        memUsage = 100 - parseInt(match[1])
      }
    } else {
      // 其他系统: 使用 os.freemem
      const totalMem = os.totalmem()
      const freeMem = os.freemem()
      memUsage = (totalMem - freeMem) / totalMem * 100
    }
  } catch {
    // 回退到 os.freemem
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    memUsage = (totalMem - freeMem) / totalMem * 100
  }

  return {
    cpu: Math.round(cpuUsage * 10) / 10,
    memory: Math.round(memUsage * 10) / 10,
    platform: process.platform,
    nodeVersion: process.version
  }
}

// ==================== 获取 Gateway 运行时间 ====================
async function getGatewayUptime() {
  try {
    // 找到 openclaw-gateway 进程的 PID
    const { stdout } = await execAsync('ps aux | grep "openclaw-gateway" | grep -v grep | head -1 | awk \'{print $2}\'', { timeout: 2000 })
    const pid = stdout.trim()
    
    if (!pid) return 0
    
    // 获取进程运行时间 (etime 格式: DD-HH:MM:SS 或 HH:MM:SS 或 MM:SS)
    const { stdout: etime } = await execAsync(`ps -p ${pid} -o etime=`, { timeout: 2000 })
    return parseEtime(etime.trim())
  } catch {
    return 0
  }
}

// 解析 etime 格式为秒数
function parseEtime(etime) {
  // 格式: "DD-HH:MM:SS" 或 "HH:MM:SS" 或 "MM:SS"
  const parts = etime.trim().replace(/-/g, ':').split(':').map(Number)
  
  if (parts.length === 3) {
    // 可能是 DD:HH:MM:SS 或 HH:MM:SS
    if (etime.includes('-')) {
      // DD-HH:MM:SS
      return parts[0] * 86400 + parts[1] * 3600 + parts[2] * 60
    } else {
      // HH:MM:SS
      return parts[0] * 3600 + parts[1] * 60 + parts[2]
    }
  } else if (parts.length === 4) {
    // DD:HH:MM:SS (after replace)
    return parts[0] * 86400 + parts[1] * 3600 + parts[2] * 60 + parts[3]
  } else if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1]
  }
  return 0
}

// ==================== 获取 OpenClaw 健康状态 ====================
async function fetchOpenClawHealth() {
  try {
    const { stdout } = await execAsync('openclaw health --json', {
      timeout: 10000,
      maxBuffer: 1024 * 1024
    })
    
    const data = JSON.parse(stdout)
    
    // 解析 agents
    const agents = (data.agents || []).map(a => ({
      id: a.agentId,
      sessions: a.sessions?.count || 0
    }))
    
    // 解析 sessions
    const sessions = data.sessions || {}
    
    return {
      connected: true,
      agents: {
        total: agents.length,
        active: agents.filter(a => a.sessions > 0).length,
        list: agents.map(a => a.id)
      },
      sessions: {
        total: sessions.count || 0
      },
      channels: data.channels || {},
      raw: data
    }
  } catch (error) {
    console.log('OpenClaw health failed:', error.message)
    return { connected: false }
  }
}

// ==================== Ping 探测 ====================
async function pingHosts() {
  const results = {}
  
  const promises = CONFIG.pingHosts.map(async ({ name, host }) => {
    try {
      const result = await ping.promise.probe(host, { timeout: 5, min_reply: 1 })
      
      if (result.alive) {
        // ping 库返回秒，转换为毫秒
        const latency = Math.round((result.time || result.avg || 0) * 1000)
        let status = 'ok'
        if (latency > 200) status = 'slow'
        else if (latency > 100) status = 'warning'
        
        return { name, data: { host, latency, status, alive: true } }
      } else {
        return { name, data: { host, latency: null, status: 'timeout', alive: false } }
      }
    } catch (error) {
      return { name, data: { host, latency: null, status: 'error', alive: false } }
    }
  })

  const pingResults = await Promise.all(promises)
  for (const { name, data } of pingResults) {
    results[name] = data
  }

  return results
}

// ==================== 主轮询函数 ====================
async function poll() {
  console.log(`[${new Date().toLocaleTimeString()}] Polling...`)
  
  try {
    const [healthData, networkData, systemStats, gatewayUptime] = await Promise.all([
      fetchOpenClawHealth(),
      pingHosts(),
      getSystemStats(),
      getGatewayUptime()
    ])

    if (healthData.connected) {
      cache = {
        gateway: {
          connected: true,
          uptime: gatewayUptime,  // 使用 Gateway 进程运行时间
          version: healthData.raw?.version || 'N/A'
        },
        agents: healthData.agents,
        system: systemStats,
        network: networkData,
        logs: [],
        errors: 0,
        lastUpdated: new Date().toISOString()
      }
    } else {
      cache.gateway.connected = false
      cache.gateway.uptime = gatewayUptime
      cache.system = systemStats
      cache.network = networkData
      cache.lastUpdated = new Date().toISOString()
    }

    console.log(`[${new Date().toLocaleTimeString()}] Updated. OpenClaw: ${cache.gateway.connected ? '✓' : '✗'}, Uptime: ${Math.floor(gatewayUptime/3600)}h, Network: ${Object.keys(networkData).length} hosts, CPU: ${systemStats.cpu}%, Mem: ${systemStats.memory}%`)
  } catch (error) {
    console.error('Poll error:', error.message)
  }
}

// ==================== HTTP Server ====================
const app = express()

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

// API: 获取数据
app.get('/health', (req, res) => {
  res.json(cache)
})

app.get('/network', (req, res) => {
  res.json(cache.network)
})

// 静态文件
const distPath = join(__dirname, '../dist')
app.use(express.static(distPath))

// SPA 回退
app.get('*', (req, res) => {
  res.sendFile(join(distPath, 'index.html'))
})

// ==================== 启动 ====================
app.listen(CONFIG.port, () => {
  console.log(`OpenClaw Dashboard running on port ${CONFIG.port}`)
  console.log(`Poll interval: ${CONFIG.pollInterval / 1000}s`)
  
  poll()
  setInterval(poll, CONFIG.pollInterval)
})