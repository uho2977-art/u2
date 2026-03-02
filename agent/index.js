import express from 'express'
import ping from 'ping'
import fetch from 'node-fetch'

// 配置
const CONFIG = {
  port: process.env.PORT || 3001,
  gatewayUrl: process.env.GATEWAY_URL || 'http://localhost:18789',
  gatewayToken: process.env.GATEWAY_TOKEN || '',
  pingHosts: [
    { name: 'GitHub', host: 'github.com' },
    { name: 'YouTube', host: 'youtube.com' },
    { name: 'Telegram', host: 'telegram.org' },
    { name: 'Google', host: 'google.com' }
  ],
  pingTimeout: 5, // 秒
  refreshInterval: 15000 // 毫秒
}

// 缓存数据
let cachedData = {
  gateway: { connected: false, uptime: 0, version: 'N/A' },
  agents: { total: 0, active: 0, list: [] },
  system: { cpu: 0, memory: 0, platform: 'unknown', nodeVersion: 'N/A' },
  network: {},
  logs: [],
  errors: 0,
  lastUpdated: null
}

// ==================== Gateway RPC ====================

async function gatewayRpc(method, params = {}) {
  try {
    const response = await fetch(`${CONFIG.gatewayUrl}/rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(CONFIG.gatewayToken && { 'Authorization': `Bearer ${CONFIG.gatewayToken}` })
      },
      body: JSON.stringify({ method, params }),
      timeout: 10000
    })

    if (!response.ok) {
      throw new Error(`Gateway returned ${response.status}`)
    }

    const data = await response.json()
    return data.ok ? data.payload || data : null
  } catch (error) {
    console.error(`RPC ${method} failed:`, error.message)
    return null
  }
}

async function fetchGatewayHealth() {
  const result = await gatewayRpc('health')
  
  if (!result) {
    return { connected: false, uptime: 0, version: 'N/A' }
  }

  const status = result.status || {}
  const agents = result.agents || {}
  const system = result.system || {}

  return {
    connected: true,
    uptime: result.uptime || status.uptime || 0,
    version: result.version || status.version || 'N/A',
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
    }
  }
}

async function fetchGatewayLogs(limit = 10) {
  const result = await gatewayRpc('logs', { limit, level: 'error' })
  
  if (!result) return []

  const logs = Array.isArray(result) ? result : (result.logs || [])
  
  return logs.map(log => ({
    timestamp: log.timestamp || log.ts || new Date().toISOString(),
    level: log.level || 'info',
    message: log.message || log.msg || ''
  }))
}

// ==================== Ping 探测 ====================

async function pingHost(host) {
  try {
    const result = await ping.promise.probe(host, {
      timeout: CONFIG.pingTimeout,
      min_reply: 1
    })

    if (result.alive) {
      const latency = result.time
      let status = 'ok'
      
      // 根据延迟判断状态
      if (latency > 200) {
        status = 'slow'
      } else if (latency > 100) {
        status = 'warning'
      }

      return {
        host,
        latency: Math.round(latency),
        status,
        alive: true
      }
    } else {
      return {
        host,
        latency: null,
        status: 'timeout',
        alive: false
      }
    }
  } catch (error) {
    return {
      host,
      latency: null,
      status: 'error',
      alive: false,
      error: error.message
    }
  }
}

async function pingAllHosts() {
  const results = {}
  
  // 并行 ping 所有主机
  const promises = CONFIG.pingHosts.map(async ({ name, host }) => {
    const result = await pingHost(host)
    return { name, ...result }
  })

  const pingResults = await Promise.all(promises)
  
  for (const result of pingResults) {
    results[result.name] = {
      host: result.host,
      latency: result.latency,
      status: result.status,
      alive: result.alive
    }
  }

  return results
}

// ==================== 数据聚合 ====================

async function refreshData() {
  console.log('Refreshing data...')
  
  try {
    // 并行获取所有数据
    const [health, logs, network] = await Promise.all([
      fetchGatewayHealth(),
      fetchGatewayLogs(5),
      pingAllHosts()
    ])

    cachedData = {
      gateway: {
        connected: health.connected,
        uptime: health.uptime,
        version: health.version
      },
      agents: health.agents,
      system: health.system,
      network,
      logs,
      errors: logs.filter(l => l.level === 'error').length,
      lastUpdated: new Date().toISOString()
    }

    console.log('Data refreshed successfully')
  } catch (error) {
    console.error('Failed to refresh data:', error.message)
  }
}

// ==================== HTTP Server ====================

const app = express()

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

// 健康检查
app.get('/health', (req, res) => {
  res.json(cachedData)
})

// 仅网络状态
app.get('/network', (req, res) => {
  res.json(cachedData.network)
})

// 仅 Gateway 状态
app.get('/gateway', (req, res) => {
  res.json({
    gateway: cachedData.gateway,
    agents: cachedData.agents,
    system: cachedData.system
  })
})

// 仅日志
app.get('/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 10
  res.json(cachedData.logs.slice(0, limit))
})

// 配置信息
app.get('/config', (req, res) => {
  res.json({
    gatewayUrl: CONFIG.gatewayUrl,
    pingHosts: CONFIG.pingHosts.map(h => h.name),
    refreshInterval: CONFIG.refreshInterval
  })
})

// 启动服务器
app.listen(CONFIG.port, () => {
  console.log(`OpenClaw Monitor Agent running on port ${CONFIG.port}`)
  console.log(`Gateway URL: ${CONFIG.gatewayUrl}`)
  console.log(`Ping hosts: ${CONFIG.pingHosts.map(h => h.name).join(', ')}`)
  
  // 立即刷新一次
  refreshData()
  
  // 定时刷新
  setInterval(refreshData, CONFIG.refreshInterval)
})