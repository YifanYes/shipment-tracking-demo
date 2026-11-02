import { ArrowDownToLine, Package, Route } from 'lucide-react'
import { Card, CardContent } from '@/shared/ui/card'

interface Props {
  active: number
  attention: number
  arrivalsToday: number
}

export function OverviewMetrics({ active, attention, arrivalsToday }: Props) {
  return (
    <section className="metric-grid" aria-label="Resumen de la operación">
      {[
        { label: 'Envíos activos', icon: Package, tone: 'blue', value: active },
        { label: 'Necesitan atención', icon: Route, tone: 'amber', value: attention },
        {
          label: 'Llegadas previstas hoy',
          icon: ArrowDownToLine,
          tone: 'green',
          value: arrivalsToday,
        },
      ].map(({ label, icon: Icon, tone, value }) => (
        <Card key={label} className="metric-card" data-tone={tone}>
          <CardContent>
            <div className="metric-label">
              <span>{label}</span>
              <Icon size={17} aria-hidden="true" />
            </div>
            <div className="metric-value" aria-live="polite">
              {value}
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}
