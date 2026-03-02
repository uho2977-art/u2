// OpenClaw Monitor Agent API client

const AGENT_URL_KEY = 'openclaw_agent_url'
const GATEWAY_URL_KEY = 'openclaw_gateway_url'
const GATEWAY_TOKEN_KEY = 'openclaw_gateway_token'

export interface GatewayConfig {
  agentUrl: string
  gatewayUrl: string
  gatewayToken: string
}

export function setGatewayConfig(agentUrl: string, gatewayUrl: string, gatewayToken: string): void {
  localStorage.setItem(AGENT_URL_KEY, agentUrl)
  localStorage.setItem(GATEWAY_URL_KEY, gatewayUrl)
  localStorage.setItem(GATEWAY_TOKEN_KEY, gatewayToken)
}

export function getGatewayConfig(): GatewayConfig {
  return {
    agentUrl: localStorage.getItem(AGENT_URL_KEY) || '',
    gatewayUrl: localStorage.getItem(GATEWAY_URL_KEY) || '',
    gatewayToken: localStorage.getItem(GATEWAY_TOKEN_KEY) || ''
  }
}

function getAgentUrl(): string {
  return localStorage.getItem(AGENT_URL_KEY) || ''
}

// 从 Agent 获取所有健康数据
export async function fetchHealth(): Promise<{
  gateway: { connected: boolean; uptime: number; version: string }
  agents: { total: number; active: number; list: string[] }
  system: { cpu: number; memory: number; platform: string; nodeVersion: string }
  network: Record<string, { host: string; latency: number | null; status: string; alive: boolean }>
  errors: number
  lastUpdated: string
}> {
  const agentUrl = getAgentUrl()
  
  if (!agentUrl) {
    throw new Error('Agent URL 未配置')
  }
  
  try {
    const response = await fetch(`${agentUrl}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })
    
    if (!response.ok) {
      throw new Error(`Agent 返回 ${response.status}`)
    }
    
    const data = await response.json()
    
    return {
      gateway: data.gateway || { connected: false, uptime: 0, version: 'N/A' },
      agents: data.agents || { total: 0, active: 0, list: [] },
      system: data.system || { cpu: 0, memory: 0, platform: 'unknown', nodeVersion: 'N/A' },
      network: data.network || {},
      errors: data.errors || 0,
      lastUpdated: data.lastUpdated || new Date().toISOString()
    }
  } catch (error) {
    console.error('Health fetch failed:', error)
    throw error
  }
}

// 日志条目类型
export interface LogEntry {
  timestamp: string
  level: 'error' | 'warn' | 'info' | 'debug'
  message: string
}

// 获取日志
export async function fetchLogs(limit: number = 10): Promise<LogEntry[]> {
  const agentUrl = getAgentUrl()
  
  if (!agentUrl) {
    return []
  }
  
  try {
    const response = await fetch(`${agentUrl}/logs?limit=${limit}`)
    
    if (!response.ok) {
      return []
    }
    
    const data = await response.json()
    return Array.isArray(data) ? data : []
  } catch (error) {
    console.error('Logs fetch failed:', error)
    return []
  }
}

// 仅获取网络状态
export async function fetchNetwork(): Promise<Record<string, { host: string; latency: number | null; status: string; alive: boolean }>> {
  const agentUrl = getAgentUrl()
  
  if (!agentUrl) {
    return {}
  }
  
  try {
    const response = await fetch(`${agentUrl}/network`)
    
    if (!response.ok) {
      return {}
    }
    
    return await response.json()
  } catch (error) {
    console.error('Network fetch failed:', error)
    return {}
  }
}