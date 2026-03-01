import type { LogEntry } from '../App'

interface LogViewerProps {
  logs: LogEntry[]
}

function LogViewer({ logs }: LogViewerProps) {
  if (logs.length === 0) {
    return <div className="log-viewer empty">暂无错误日志</div>
  }

  return (
    <div className="log-viewer">
      {logs.map((log, index) => (
        <div key={index} className={`log-entry log-${log.level}`}>
          <span className="log-time">
            {new Date(log.timestamp).toLocaleTimeString('zh-CN')}
          </span>
          <span className="log-level">[{log.level.toUpperCase()}]</span>
          <span className="log-message">{log.message}</span>
        </div>
      ))}
    </div>
  )
}

export default LogViewer