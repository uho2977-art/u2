import { useState, useEffect } from 'react'
import './App.css'
import StatusCard from './components/StatusCard'
import MetricCard from './components/MetricCard'
import LogViewer from './components/LogViewer'
import { fetchHealth } from './api/openclaw'

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
  logs: LogEntry[]
  lastUpdated: string
}

export interface LogEntry {
  timestamp: string
  level: 'error' | 'warn' | 'info' | 'debug'
  message: string
}

function App() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await fetchHealth()
        setHealth(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : '连接失败')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 15000) // 15秒刷新

    return () => clearInterval(interval)
  }, [])

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (days > 0) return `${days}天 ${hours}小时`
    if (hours > 0) return `${hours}小时 ${minutes}分钟`
    return `${minutes}分钟`
  }

  return (
    <div className="app">
      <header className="header">
        <h1>⚙️ OpenClaw Dashboard</h1>
        <div className="header-info">
          {health && (
            <span className="last-update">
              更新于: {new Date(health.lastUpdated).toLocaleTimeString('zh-CN')}
            </span>
          )}
        </div>
      </header>

      {loading && !health && (
        <div className="loading">
          <div className="spinner"></div>
          <p>正在连接 Gateway...</p>
        </div>
      )}

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {health && (
        <main className="dashboard">
          {/* Gateway 状态 */}
          <section className="section">
            <h2>Gateway 状态</h2>
            <div className="cards-row">
              <StatusCard
                title="连接状态"
                status={health.gateway.connected ? 'online' : 'offline'}
                value={health.gateway.connected ? '已连接' : '已断开'}
              />
              <StatusCard
                title="运行时间"
                status="info"
                value={formatUptime(health.gateway.uptime)}
              />
              <StatusCard
                title="版本"
                status="info"
                value={health.gateway.version || 'N/A'}
              />
            </div>
          </section>

          {/* Agent 状态 */}
          <section className="section">
            <h2>Agent 状态</h2>
            <div className="cards-row">
              <MetricCard
                title="Agent 总数"
                value={health.agents.total}
                unit="个"
              />
              <MetricCard
                title="活跃 Agent"
                value={health.agents.active}
                unit="个"
                highlight={health.agents.active > 0}
              />
            </div>
            {health.agents.list.length > 0 && (
              <div className="agent-list">
                <h3>Agent 列表</h3>
                <div className="agent-grid">
                  {health.agents.list.map((agent, index) => (
                    <span key={index} className="agent-tag">{agent}</span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* 系统资源 */}
          <section className="section">
            <h2>系统资源</h2>
            <div className="cards-row">
              <MetricCard
                title="CPU 使用率"
                value={Math.round(health.system.cpu)}
                unit="%"
                warning={health.system.cpu > 80}
              />
              <MetricCard
                title="内存使用率"
                value={Math.round(health.system.memory)}
                unit="%"
                warning={health.system.memory > 80}
              />
            </div>
            <div className="system-info">
              <span>平台: {health.system.platform}</span>
              <span>Node: {health.system.nodeVersion}</span>
            </div>
          </section>

          {/* 错误日志 */}
          <section className="section">
            <h2>系统错误日志</h2>
            <LogViewer logs={health.logs.filter(l => l.level === 'error').slice(-5)} />
          </section>
        </main>
      )}

      <footer className="footer">
        <p>OpenClaw Dashboard • 刷新频率: 15秒</p>
      </footer>
    </div>
  )
}

export default App