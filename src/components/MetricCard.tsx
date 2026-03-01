interface MetricCardProps {
  title: string
  value: number
  unit: string
  highlight?: boolean
  warning?: boolean
}

function MetricCard({ title, value, unit, highlight, warning }: MetricCardProps) {
  const cardClass = `metric-card${highlight ? ' highlighted' : ''}${warning ? ' warning' : ''}`
  
  return (
    <div className={cardClass}>
      <h3>{title}</h3>
      <div className="metric-value">
        <span className="value">{value}</span>
        <span className="unit">{unit}</span>
      </div>
      {highlight && <span className="indicator online"></span>}
      {warning && <span className="indicator warning"></span>}
    </div>
  )
}

export default MetricCard