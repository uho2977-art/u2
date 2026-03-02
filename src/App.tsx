import { useState, useEffect, useCallback } from 'react'
import './App.css'
import { fetchHealth, fetchLogs, setGatewayConfig, type LogEntry } from './api/openclaw'

export interface HealthData {
  gateway: {
    connected: boolean
    uptime: number
    version: string
  }
  agents: {
    total: number
    active: number
    list: string[]
  }
  system: {
    cpu: number
    memory: number
    platform: string
    nodeVersion: string
  }
  network: Record<string, {
    host: string
    latency: number | null
    status: string
    alive: boolean
  }>
  errors: number
  lastUpdated: string
}

type StatusType = 'green' | 'yellow' | 'red'

function App() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // 全屏切换
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch (err) {
      // 某些浏览器可能不支持
      console.log('Fullscreen not supported')
    }
  }

  // 检查是否已配置
  useEffect(() => {
    const agentUrl = localStorage.getItem('openclaw_agent_url')
    if (agentUrl) {
      setConfigured(true)
    }
    
    // 监听全屏状态变化
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // 获取健康状态
  const fetchData = useCallback(async () => {
    try {
      const [healthData, logsData] = await Promise.all([
        fetchHealth(),
        fetchLogs(5)
      ])
      
      setHealth(healthData)
      setLogs(logsData)
    } catch {
      // 使用模拟数据
      setHealth(getMockHealth())
      setLogs(getMockLogs())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!configured) return
    
    fetchData()
    const interval = setInterval(fetchData, 15000)
    return () => clearInterval(interval)
  }, [configured, fetchData])

  // 计算状态
  const getStatus = (): StatusType => {
    if (!health) return 'red'
    if (!health.gateway.connected) return 'red'
    
    // 检查网络状态
    const networkValues = Object.values(health.network)
    const hasTimeout = networkValues.some(n => !n.alive)
    const hasSlow = networkValues.some(n => n.status === 'slow')
    
    if (hasTimeout) return 'yellow'
    if (health.errors > 0 || health.system.memory > 80 || hasSlow) return 'yellow'
    return 'green'
  }

  // 格式化运行时间
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (days > 0) return `${days}天 ${hours}小时`
    if (hours > 0) return `${hours}小时 ${minutes}分钟`
    return `${minutes}分钟`
  }

  // 配置 Gateway
  const handleConfig = (agentUrl: string, gatewayUrl: string, gatewayToken: string) => {
    setGatewayConfig(agentUrl, gatewayUrl, gatewayToken)
    setConfigured(true)
    setLoading(true)
    fetchData()
  }

  // 未配置时显示配置界面
  if (!configured) {
    return <ConfigScreen onConfig={handleConfig} />
  }

  // 加载中
  if (loading && !health) {
    return (
      <div className="dashboard">
        <div className="loading">
          <div className="main-indicator green" style={{ width: 80, height: 80, opacity: 0.5 }}></div>
          <p>连接中...</p>
        </div>
      </div>
    )
  }

  const status = getStatus()
  const errorLogs = logs.filter(l => l.level === 'error').slice(0, 5)

  return (
    <div className="dashboard">
      {/* 全屏按钮 */}
      <button className="fullscreen-btn" onClick={toggleFullscreen}>
        {isFullscreen ? '⤡' : '⤢'}
      </button>
      
      {/* 主区域：指示灯 + 指标 */}
      <div className="main-section">
        <div className="status-block">
          <div className={`main-indicator ${status}`}></div>
          <div className="uptime-section">
            <div className="uptime-value">{health ? formatUptime(health.gateway.uptime) : '--'}</div>
            <div className="uptime-label">运行时间</div>
          </div>
        </div>
        
        <div className="metrics-grid">
          {/* Agent */}
          <div className="metric-card">
            <div className="metric-value green">
              {health?.agents.active ?? 0}
              <span className="metric-sub">/{health?.agents.total ?? 0}</span>
            </div>
            <div className="metric-label">Agent</div>
          </div>
          
          {/* CPU + 内存 合并 */}
          <div className="metric-card dual">
            <div className="metric-dual-item">
              <div className="metric-dual-value blue">
                {Math.round(health?.system.cpu ?? 0)}
                <span className="metric-sub">%</span>
              </div>
              <div className="metric-dual-label">CPU</div>
            </div>
            <div className="metric-divider"></div>
            <div className="metric-dual-item">
              <div className="metric-dual-value orange">
                {Math.round(health?.system.memory ?? 0)}
                <span className="metric-sub">%</span>
              </div>
              <div className="metric-dual-label">内存</div>
            </div>
          </div>
          
          {/* 错误数 */}
          <div className="metric-card">
            <div className="metric-value red">{errorLogs.length}</div>
            <div className="metric-label">错误</div>
          </div>
        </div>
      </div>
      
      {/* 网络状态 */}
      {health?.network && Object.keys(health.network).length > 0 && (
        <div className="network-section">
          <div className="network-grid">
            {Object.entries(health.network).map(([name, data]) => (
              <div key={name} className={`network-card ${data.alive ? (data.status === 'slow' ? 'slow' : 'ok') : 'timeout'}`}>
                <div className="network-name">{name}</div>
                <div className="network-status">
                  {data.alive ? `${data.latency}ms` : '✕'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* 日志横幅 */}
      <div className="logs-section">
        <div className="logs-label">日志</div>
        <div className="logs-ticker">
          <div className="logs-ticker-inner">
            {[...errorLogs, ...errorLogs].map((log, i) => (
              <div key={i} className={`log-item ${log.level}`}>
                <span className="log-time">{formatTime(log.timestamp)}</span>
                {log.message}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// 配置界面
function ConfigScreen({ onConfig }: { onConfig: (agentUrl: string, gatewayUrl: string, gatewayToken: string) => void }) {
  const [agentUrl, setAgentUrl] = useState('')
  const [gatewayUrl, setGatewayUrl] = useState('')
  const [gatewayToken, setGatewayToken] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (agentUrl) {
      onConfig(agentUrl, gatewayUrl, gatewayToken)
    }
  }

  return (
    <div className="config-screen">
      <div className="config-card">
        <div className="config-title">⚙️ OpenClaw Dashboard</div>
        <p className="config-desc">配置监控服务</p>
        
        <form onSubmit={handleSubmit}>
          <div className="config-field">
            <label>Monitor Agent URL</label>
            <input
              type="text"
              placeholder="http://localhost:3001"
              value={agentUrl}
              onChange={e => setAgentUrl(e.target.value)}
              required
            />
            <span className="config-hint">监控 Agent 地址</span>
          </div>
          
          <div className="config-field">
            <label>Gateway URL (可选)</label>
            <input
              type="text"
              placeholder="http://192.168.1.100:18789"
              value={gatewayUrl}
              onChange={e => setGatewayUrl(e.target.value)}
            />
            <span className="config-hint">仅当 Agent 需要转发时填写</span>
          </div>
          
          <div className="config-field">
            <label>Gateway Token (可选)</label>
            <input
              type="password"
              placeholder="Gateway 认证 Token"
              value={gatewayToken}
              onChange={e => setGatewayToken(e.target.value)}
            />
          </div>
          
          <button type="submit" className="config-btn">
            连接
          </button>
        </form>
      </div>
    </div>
  )
}

// 格式化时间
function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return timestamp
  }
}

// 模拟数据
function getMockHealth(): HealthData {
  return {
    gateway: { connected: true, uptime: 86400 + Math.floor(Math.random() * 7200), version: '1.0.0' },
    agents: { total: 3, active: 2, list: ['main', 'coder', 'assistant'] },
    system: { cpu: 25 + Math.floor(Math.random() * 30), memory: 40 + Math.floor(Math.random() * 30), platform: 'darwin', nodeVersion: 'v22.0.0' },
    network: {
      'GitHub': { host: 'github.com', latency: 45 + Math.floor(Math.random() * 50), status: 'ok', alive: true },
      'YouTube': { host: 'youtube.com', latency: 80 + Math.floor(Math.random() * 100), status: 'ok', alive: true },
      'Telegram': { host: 'telegram.org', latency: 35 + Math.floor(Math.random() * 30), status: 'ok', alive: true },
      'Google': { host: 'google.com', latency: 30 + Math.floor(Math.random() * 40), status: 'ok', alive: true }
    },
    errors: Math.floor(Math.random() * 3),
    lastUpdated: new Date().toISOString()
  }
}

function getMockLogs(): LogEntry[] {
  const now = Date.now()
  return [
    { timestamp: new Date(now - 300000).toISOString(), level: 'error', message: '请求超时: /v1/chat/completions' },
    { timestamp: new Date(now - 180000).toISOString(), level: 'warn', message: '内存使用率超过 60%' },
    { timestamp: new Date(now - 120000).toISOString(), level: 'info', message: 'Agent main 已连接' },
    { timestamp: new Date(now - 60000).toISOString(), level: 'info', message: 'Gateway 启动成功' },
    { timestamp: new Date(now - 30000).toISOString(), level: 'error', message: '连接 Agent assistant 失败' },
  ]
}

export default App