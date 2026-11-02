import { useEffect, useMemo } from 'react'
import { ChartNoAxesCombined, Package } from 'lucide-react'
import { arrivalsToday } from '@/domain/attention'
import { selectSummary, selectVisibleShipments } from '@/domain/selectors'
import { OverviewMetrics, ShipmentOverview } from '@/features/overview'
import { ShipmentDetail, ShipmentList } from '@/features/shipments'
import { useWorkspaceStore } from '@/store/workspace-store'
import { Sidebar } from './layout/sidebar'
import { Topbar } from './layout/topbar'
import './layout/layout.css'
import { navigation } from './navigation'
import { useWorkspaceNavigation } from './use-workspace-navigation'

export function App() {
  const state = useWorkspaceStore()
  const shipments = useMemo(() => selectVisibleShipments(state), [state])
  const summary = selectSummary(shipments, state.cutoffAt)
  const selected = shipments.find((item) => item.shipment.id === state.selectedShipmentId)
  const identity = state.dataset.identities.find((item) => item.id === state.identityId)!
  const { view, setView, sidebarCollapsed, toggleSidebar } = state
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
      <Sidebar
        view={view}
        collapsed={sidebarCollapsed}
        onNavigate={setView}
        demoControls={
          identity.role === 'operations' && shipments.length > 0
            ? {
                canAdvance: summary.delivered !== shipments.length,
                onAdvance: state.advanceDemo,
                onReset: state.resetDemo,
              }
            : null
        }
      />

      <div className="main-shell">
        <Topbar
          title={pageTitle}
          count={view === 'shipments' ? shipments.length : null}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebar}
          identities={state.dataset.identities}
          identityId={state.identityId}
          onIdentityChange={state.setIdentity}
        />

        <main id="main-content" className="main-content" aria-labelledby="page-title" tabIndex={-1}>
          {view === 'overview' && (
            <>
              <OverviewMetrics
                active={summary.active}
                attention={summary.attention}
                arrivalsToday={arrivalsToday(shipments, state.cutoffAt)}
              />
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
