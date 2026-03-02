// OpenClaw Gateway API client

const GATEWAY_URL_KEY = 'openclaw_gateway_url'
const GATEWAY_TOKEN_KEY = 'openclaw_gateway_token'

export interface GatewayConfig {
  url: string
  token: string
}

export function setGatewayConfig(url: string, token: string): void {
  localStorage.setItem(GATEWAY_URL_KEY, url)
  localStorage.setItem(GATEWAY_TOKEN_KEY, token)
}

export function getGatewayConfig(): GatewayConfig {
  return {
    url: localStorage.getItem(GATEWAY_URL_KEY) || '',
    token: localStorage.getItem(GATEWAY_TOKEN_KEY) || ''
  }
}

function getUrl(): string {
  return localStorage.getItem(GATEWAY_URL_KEY) || ''
}

function getToken(): string {
  return localStorage.getItem(GATEWAY_TOKEN_KEY) || ''
}

// RPC 调用
async function rpc(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
  const url = getUrl()
  const token = getToken()
  
  if (!url) {
    throw new Error('Gateway URL 未配置')
  }
  
  const response = await fetch(`${url.replace(/\/$/, '')}/rpc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    },
    body: JSON.stringify({ method, params })
  })
  
  if (!response.ok) {
    throw new Error(`Gateway 返回 ${response.status}`)
  }
  
  const data = await response.json()
  
  if (!data.ok) {
    throw new Error(data.error || 'RPC 调用失败')
  }
  
  return data.payload || data
}

// 获取健康状态
export async function fetchHealth(): Promise<{
  gateway: { connected: boolean; uptime: number; version: string }
  agents: { total: number; active: number; list: string[] }
  system: { cpu: number; memory: number; platform: string; nodeVersion: string }
  errors: number
  lastUpdated: string
}> {
  try {
    const result = await rpc('health') as Record<string, unknown>
    const status = (result.status as Record<string, unknown>) || {}
    const agents = (result.agents as Record<string, unknown>) || {}
    const system = (result.system as Record<string, unknown>) || {}
    
    return {
      gateway: {
        connected: true,
        uptime: (result.uptime as number) || (status.uptime as number) || 0,
        version: (result.version as string) || (status.version as string) || 'N/A'
      },
      agents: {
        total: (agents.total as number) || (result.agentCount as number) || 0,
        active: (agents.active as number) || (result.activeAgents as number) || 0,
        list: (agents.list as string[]) || (result.agentList as string[]) || []
      },
      system: {
        cpu: (system.cpu as number) || (result.cpu as number) || 0,
        memory: (system.memory as number) || (result.memory as number) || 0,
        platform: (system.platform as string) || (result.platform as string) || 'unknown',
        nodeVersion: (system.nodeVersion as string) || (result.nodeVersion as string) || 'N/A'
      },
      errors: (result.errors as number) || (result.recentErrors as number) || 0,
      lastUpdated: new Date().toISOString()
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
export async function fetchLogs(limit: number = 10, level?: string): Promise<LogEntry[]> {
  try {
    const params: Record<string, unknown> = { limit }
    if (level) {
      params.level = level
    }
    
    const result = await rpc('logs', params)
    
    // 处理可能的返回格式
    if (Array.isArray(result)) {
      return result.map((log: Record<string, unknown>) => ({
        timestamp: (log.timestamp as string) || (log.ts as string) || new Date().toISOString(),
        level: (log.level as 'error' | 'warn' | 'info' | 'debug') || 'info',
        message: (log.message as string) || (log.msg as string) || ''
      }))
    }
    
    if (result && typeof result === 'object' && 'logs' in result) {
      const logs = (result as Record<string, unknown>).logs
      if (Array.isArray(logs)) {
        return logs.map((log: Record<string, unknown>) => ({
          timestamp: (log.timestamp as string) || (log.ts as string) || new Date().toISOString(),
          level: (log.level as 'error' | 'warn' | 'info' | 'debug') || 'info',
          message: (log.message as string) || (log.msg as string) || ''
        }))
      }
    }
    
    return []
  } catch (error) {
    console.error('Logs fetch failed:', error)
    return []
  }
}

// 获取 Agent 列表
export async function fetchAgents(): Promise<string[]> {
  try {
    const result = await rpc('agents.list')
    
    if (Array.isArray(result)) {
      return result.map((a: Record<string, unknown>) => (a.id as string) || (a.name as string) || String(a))
    }
    
    if (result && typeof result === 'object' && 'agents' in result) {
      const agents = (result as Record<string, unknown>).agents
      if (Array.isArray(agents)) {
        return agents.map((a: Record<string, unknown>) => (a.id as string) || (a.name as string) || String(a))
      }
    }
    
    return []
  } catch (error) {
    console.error('Agents fetch failed:', error)
    return []
  }
}

// 获取会话列表
export async function fetchSessions(): Promise<Array<Record<string, unknown>>> {
  try {
    const result = await rpc('sessions.list')
    
    if (Array.isArray(result)) {
      return result as Array<Record<string, unknown>>
    }
    
    if (result && typeof result === 'object' && 'sessions' in result) {
      return (result as Record<string, unknown>).sessions as Array<Record<string, unknown>>
    }
    
    return []
  } catch (error) {
    console.error('Sessions fetch failed:', error)
    return []
  }
}