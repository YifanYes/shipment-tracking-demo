import { useEffect, useMemo } from 'react'
import {
  ArrowDownToLine,
  ChartNoAxesCombined,
  ChevronDown,
  LayoutDashboard,
  Package,
  PanelLeft,
  Route,
  Truck,
  RotateCcw,
  SkipForward,
  UserRound,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useWorkspaceStore, type WorkspaceView } from '@/store/use-workspace-store'
import { selectVisibleShipments, selectSummary } from '@/domain/selectors'
import { ShipmentList } from '@/features/shipments/ShipmentTracking'
import { ShipmentDetail } from '@/features/shipments/ShipmentDetail'
import { ShipmentOverview } from '@/features/overview/ShipmentOverview'
import { arrivalsToday } from '@/domain/map'
import { useWorkspaceNavigation } from './use-workspace-navigation'

const navigation = [
  { id: 'overview', label: 'Vista general', icon: LayoutDashboard },
  { id: 'shipments', label: 'Envíos', icon: Truck },
  { id: 'analytics', label: 'Análisis', icon: ChartNoAxesCombined },
] satisfies { id: WorkspaceView; label: string; icon: typeof Truck }[]

export function App() {
  const state = useWorkspaceStore()
  const shipments = useMemo(() => selectVisibleShipments(state), [state])
  const summary = selectSummary(shipments, state.cutoffAt)
  const selected = shipments.find((item) => item.shipment.id === state.selectedShipmentId)
  const identity = state.dataset.identities.find((item) => item.id === state.identityId)!
  const { view, setView, sidebarCollapsed, toggleSidebar } = state
  const sidebarToggleLabel = sidebarCollapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'
  const pageTitle =
    view === 'shipment-detail'
      ? 'Detalle del envío'
      : (navigation.find((item) => item.id === view)?.label ?? 'Vista general')
  useWorkspaceNavigation()

  useEffect(() => {
    document.title = `${selected?.shipment.reference ?? pageTitle} | Atlas`
  }, [pageTitle, selected?.shipment.reference])

  return (
    <div className="workspace">
      <a className="skip-link" href="#main-content">
        Saltar al contenido
      </a>
      <aside className="sidebar" aria-label="Menú principal" data-collapsed={sidebarCollapsed}>
        <div className="sidebar-header">
          <div className="brand">
            <img className="brand-mark" src="/atlas-mark.svg" alt="" width="36" height="36" />
            <span className="brand-wordmark">Atlas</span>
          </div>
        </div>
        <div className="workspace-label">CONTROL LOGÍSTICO</div>
        <nav id="workspace-navigation" className="navigation" aria-label="Navegación">
          {navigation.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              variant="ghost"
              className={`nav-button ${view === id || (id === 'shipments' && view === 'shipment-detail') ? 'nav-button-active' : ''}`}
              aria-current={
                view === id
                  ? 'page'
                  : id === 'shipments' && view === 'shipment-detail'
                    ? 'location'
                    : undefined
              }
              aria-label={label}
              title={sidebarCollapsed ? label : undefined}
              onClick={() => setView(id)}
            >
              <Icon size={18} />
              <span className="nav-label">{label}</span>
            </Button>
          ))}
        </nav>
        {identity.role === 'operations' && shipments.length > 0 && (
          <fieldset className="sidebar-footer" aria-label="Controles de demo">
            <Button
              variant="outline"
              className="sidebar-demo-button"
              disabled={summary.delivered === shipments.length}
              onClick={state.advanceDemo}
              aria-label="Confirmar entrega · +2 h"
              title="Confirmar entrega · +2 h"
            >
              <SkipForward size={16} aria-hidden="true" />
              <span className="sidebar-action-label">
                Confirmar entrega<small>+2 h</small>
              </span>
            </Button>
            <Button
              variant="ghost"
              className="sidebar-demo-button"
              onClick={state.resetDemo}
              aria-label="Reiniciar"
              title="Reiniciar"
            >
              <RotateCcw size={16} aria-hidden="true" />
              <span className="sidebar-action-label">Reiniciar</span>
            </Button>
          </fieldset>
        )}
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-start">
            <Button
              variant="ghost"
              size="icon"
              className="sidebar-toggle"
              onClick={toggleSidebar}
              aria-label={sidebarToggleLabel}
              title={sidebarToggleLabel}
              aria-expanded={!sidebarCollapsed}
              aria-controls="workspace-navigation"
            >
              <PanelLeft size={17} />
            </Button>
            <div className="page-identity">
              <h1 id="page-title" className="page-title">
                {pageTitle}
              </h1>
              {view === 'shipments' && (
                <Badge
                  variant="secondary"
                  className="page-count"
                  aria-label={`${shipments.length} envíos`}
                >
                  {shipments.length}
                </Badge>
              )}
            </div>
          </div>
          <div className="topbar-end">
            <label className="identity-picker">
              <UserRound size={16} aria-hidden="true" />
              <select
                aria-label="Identidad"
                value={state.identityId}
                onChange={(event) => state.setIdentity(event.target.value)}
              >
                {state.dataset.identities.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="identity-chevron" size={14} aria-hidden="true" />
            </label>
          </div>
        </header>

        <main id="main-content" className="main-content" aria-labelledby="page-title" tabIndex={-1}>
          {view === 'overview' && (
            <>
              <section className="metric-grid" aria-label="Resumen de la operación">
                {[
                  {
                    label: 'Envíos activos',
                    icon: Package,
                    tone: 'blue',
                    value: summary.active,
                  },
                  {
                    label: 'Necesitan atención',
                    icon: Route,
                    tone: 'amber',
                    value: summary.attention,
                  },
                  {
                    label: 'Llegadas previstas hoy',
                    icon: ArrowDownToLine,
                    tone: 'green',
                    value: arrivalsToday(shipments, state.cutoffAt),
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

              <ShipmentOverview
                key={state.identityId}
                shipments={shipments}
                cutoffAt={state.cutoffAt}
                onOpenShipment={state.selectShipment}
              />
            </>
          )}

          {view === 'shipments' && (
            <ShipmentList shipments={shipments} onSelect={state.selectShipment} />
          )}
          {selected && view === 'shipment-detail' && (
            <ShipmentDetail
              key={selected.shipment.id}
              item={selected}
              onBack={() => setView('shipments')}
            />
          )}
          {view === 'analytics' && (
            <EmptyPage
              icon={ChartNoAxesCombined}
              title="No hay histórico de envíos"
              description="El reporte estará disponible cuando haya envíos históricos para analizar."
            />
          )}
        </main>
      </div>
    </div>
  )
}

function EmptyPage({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Package
  title: string
  description: string
}) {
  return (
    <section className="empty-page">
      <div className="empty-icon">
        <Icon size={30} />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  )
}
