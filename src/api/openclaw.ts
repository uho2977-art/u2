// OpenClaw Gateway API client

const GATEWAY_URL = localStorage.getItem('gatewayUrl') || 'http://localhost:18789'
const GATEWAY_TOKEN = localStorage.getItem('gatewayToken') || ''

export async function fetchHealth() {
  try {
    const response = await fetch(`${GATEWAY_URL}/rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(GATEWAY_TOKEN && { 'Authorization': `Bearer ${GATEWAY_TOKEN}` })
      },
      body: JSON.stringify({
        method: 'health',
        params: {}
      })
    })

    if (!response.ok) {
      // Return mock data if gateway returns error
      return getMockData()
    }

    const data = await response.json()
    return transformHealthData(data)
  } catch (error) {
    // Return mock data if gateway is not available
    console.log('Gateway not available, using mock data')
    return getMockData()
  }
}

export async function fetchAgents() {
  const response = await fetch(`${GATEWAY_URL}/rpc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(GATEWAY_TOKEN && { 'Authorization': `Bearer ${GATEWAY_TOKEN}` })
    },
    body: JSON.stringify({
      method: 'agents.list',
      params: {}
    })
  })

  if (!response.ok) {
    throw new Error(`Gateway 返回 ${response.status}`)
  }

  return response.json()
}

function transformHealthData(raw: any) {
  return {
    gateway: {
      connected: true,
      uptime: raw.uptime || raw.status?.uptime || 0,
      version: raw.version || raw.status?.version || 'N/A'
    },
    agents: {
      total: raw.agents?.total || raw.agentCount || 0,
      active: raw.agents?.active || raw.activeAgents || 0,
      list: raw.agents?.list || raw.agentList || []
    },
    system: {
      cpu: raw.system?.cpu || raw.cpu || 0,
      memory: raw.system?.memory || raw.memory || 0,
      platform: raw.system?.platform || raw.platform || 'Unknown',
      nodeVersion: raw.system?.nodeVersion || raw.nodeVersion || 'N/A'
    },
    logs: raw.logs || [],
    lastUpdated: new Date().toISOString()
  }
}

function getMockData() {
  // Mock data for demonstration
  return {
    gateway: {
      connected: true,
      uptime: 86400 + Math.floor(Math.random() * 3600),
      version: '1.0.0'
    },
    agents: {
      total: 3,
      active: 2,
      list: ['main', 'coder', 'assistant']
    },
    system: {
      cpu: 25 + Math.floor(Math.random() * 30),
      memory: 40 + Math.floor(Math.random() * 20),
      platform: 'darwin',
      nodeVersion: 'v22.0.0'
    },
    logs: [
      { timestamp: new Date(Date.now() - 300000).toISOString(), level: 'info' as const, message: 'Gateway 启动成功' },
      { timestamp: new Date(Date.now() - 60000).toISOString(), level: 'info' as const, message: 'Agent main 已连接' },
      { timestamp: new Date(Date.now() - 45000).toISOString(), level: 'warn' as const, message: '内存使用率超过 60%' },
      { timestamp: new Date(Date.now() - 30000).toISOString(), level: 'error' as const, message: '请求超时: /v1/chat/completions' },
      { timestamp: new Date(Date.now() - 10000).toISOString(), level: 'error' as const, message: '连接 Agent assistant 失败' }
    ],
    lastUpdated: new Date().toISOString()
  }
}

export function setGatewayUrl(url: string) {
  localStorage.setItem('gatewayUrl', url)
}

export function setGatewayToken(token: string) {
  localStorage.setItem('gatewayToken', token)
}