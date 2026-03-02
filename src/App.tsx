import { useState, useEffect, useCallback } from 'react'
import './App.css'

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
  const [loading, setLoading] = useState(true)
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
    } catch {
      console.log('Fullscreen not supported')
    }
  }

  // 获取数据（直接从同源 API 获取）
  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/health')
      if (!response.ok) throw new Error('Failed')
      const data = await response.json()
      setHealth(data)
    } catch {
      // 使用模拟数据
      setHealth(getMockHealth())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // 监听全屏状态变化
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    
    // 立即获取一次
    fetchData()
    
    // 定时刷新（每 30 秒）
    const interval = setInterval(fetchData, 30000)
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      clearInterval(interval)
    }
  }, [fetchData])

  // 计算状态
  const getStatus = (): StatusType => {
    if (!health) return 'red'
    if (!health.gateway.connected) return 'red'
    
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

  // 加载中
  if (loading) {
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
  const errorLogs = (health?.logs || []).filter((l: {level: string}) => l.level === 'error').slice(0, 5)

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
          
          {/* CPU + 内存 */}
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

// 格式化时间（包含日期）
function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    
    if (isToday) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return timestamp
  }
}

// 模拟数据
function getMockHealth(): HealthData {
  return {
    gateway: { connected: false, uptime: 0, version: 'N/A' },
    agents: { total: 0, active: 0, list: [] },
    system: { cpu: 0, memory: 0, platform: 'unknown', nodeVersion: 'N/A' },
    network: {},
    logs: [],
    errors: 0,
    lastUpdated: new Date().toISOString()
  }
}

export default App