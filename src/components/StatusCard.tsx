interface StatusCardProps {
  title: string
  status: 'online' | 'offline' | 'info'
  value: string
}

function StatusCard({ title, status, value }: StatusCardProps) {
  const statusClass = `status-indicator status-${status}`
  
  return (
    <div className="status-card">
      <div className="status-header">
        <span className={statusClass}></span>
        <h3>{title}</h3>
      </div>
      <div className="status-value">{value}</div>
    </div>
  )
}

export default StatusCard