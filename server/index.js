import express from 'express'
import ping from 'ping'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ==================== 配置 ====================
const CONFIG = {
  port: process.env.PORT || 3001,
  gateway: {
    host: process.env.GATEWAY_HOST || '127.0.0.1',
    port: parseInt(process.env.GATEWAY_PORT || '18789'),
    token: process.env.GATEWAY_TOKEN || ''
  },
  pingHosts: [
    { name: 'GitHub', host: 'github.com' },
    { name: 'YouTube', host: 'youtube.com' },
    { name: 'Telegram', host: 'telegram.org' },
    { name: 'Google', host: 'google.com' }
  ],
  pollInterval: 120000 // 120秒
}

// ==================== 单一内存缓存 ====================
let cache = {
  gateway: { connected: false, uptime: 0, version: 'N/A' },
  agents: { total: 0, active: 0, list: [] },
  system: { cpu: 0, memory: 0, platform: 'unknown', nodeVersion: 'N/A' },
  network: {},
  logs: [],
  errors: 0,
  lastUpdated: null
}

// ==================== Gateway 请求 ====================
async function fetchGateway() {
  const url = `http://${CONFIG.gateway.host}:${CONFIG.gateway.port}/rpc`
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(CONFIG.gateway.token && { 'Authorization': `Bearer ${CONFIG.gateway.token}` })
      },
      body: JSON.stringify({ method: 'health' }),
      signal: AbortSignal.timeout(5000)
    })

    if (!response.ok) {
      throw new Error(`Gateway returned ${response.status}`)
    }

    const data = await response.json()
    
    if (!data.ok) {
      throw new Error(data.error || 'RPC failed')
    }

    const result = data.payload || data
    const status = result.status || {}
    const agents = result.agents || {}
    const system = result.system || {}

    // 获取日志
    let logs = []
    try {
      const logsRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(CONFIG.gateway.token && { 'Authorization': `Bearer ${CONFIG.gateway.token}` })
        },
        body: JSON.stringify({ method: 'logs', params: { limit: 5, level: 'error' } }),
        signal: AbortSignal.timeout(5000)
      })
      
      if (logsRes.ok) {
        const logsData = await logsRes.json()
        const rawLogs = logsData.payload || logsData
        if (Array.isArray(rawLogs)) {
          logs = rawLogs.map(l => ({
            timestamp: l.timestamp || l.ts || new Date().toISOString(),
            level: l.level || 'info',
            message: l.message || l.msg || ''
          }))
        }
      }
    } catch {
      // 忽略日志错误
    }

    return {
      connected: true,
      gateway: {
        connected: true,
        uptime: result.uptime || status.uptime || 0,
        version: result.version || status.version || 'N/A'
      },
      agents: {
        total: agents.total || result.agentCount || 0,
        active: agents.active || result.activeAgents || 0,
        list: agents.list || result.agentList || []
      },
      system: {
        cpu: system.cpu || result.cpu || 0,
        memory: system.memory || result.memory || 0,
        platform: system.platform || result.platform || 'unknown',
        nodeVersion: system.nodeVersion || result.nodeVersion || 'N/A'
      },
      logs,
      errors: logs.filter(l => l.level === 'error').length,
      lastUpdated: new Date().toISOString()
    }
  } catch (error) {
    console.log('Gateway connection failed:', error.message)
    return { connected: false }
  }
}

// ==================== Ping 探测 ====================
async function pingHosts() {
  const results = {}
  
  // 并行 ping
  const promises = CONFIG.pingHosts.map(async ({ name, host }) => {
    try {
      const result = await ping.promise.probe(host, { timeout: 5, min_reply: 1 })
      
      if (result.alive) {
        const latency = result.time
        let status = 'ok'
        if (latency > 200) status = 'slow'
        else if (latency > 100) status = 'warning'
        
        return { name, data: { host, latency: Math.round(latency), status, alive: true } }
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
    // 并行获取 Gateway 和 Ping
    const [gatewayData, networkData] = await Promise.all([
      fetchGateway(),
      pingHosts()
    ])

    // 更新缓存（覆盖旧数据）
    if (gatewayData.connected) {
      cache = {
        ...gatewayData,
        network: networkData
      }
    } else {
      // Gateway 断开时保留网络数据
      cache.network = networkData
      cache.gateway.connected = false
      cache.lastUpdated = new Date().toISOString()
    }

    console.log(`[${new Date().toLocaleTimeString()}] Updated. Gateway: ${cache.gateway.connected ? '✓' : '✗'}, Network: ${Object.keys(networkData).length} hosts`)
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

// 静态文件（生产构建后）
const distPath = join(__dirname, '../dist')
app.use(express.static(distPath))

// SPA 回退
app.get('*', (req, res) => {
  res.sendFile(join(distPath, 'index.html'))
})

// ==================== 启动 ====================
app.listen(CONFIG.port, () => {
  console.log(`OpenClaw Dashboard running on port ${CONFIG.port}`)
  console.log(`Gateway: ${CONFIG.gateway.host}:${CONFIG.gateway.port}`)
  console.log(`Poll interval: ${CONFIG.pollInterval / 1000}s`)
  
  // 启动时立即轮询一次
  poll()
  
  // 定时轮询
  setInterval(poll, CONFIG.pollInterval)
})