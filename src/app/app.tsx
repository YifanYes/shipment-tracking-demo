import { useEffect, useMemo } from 'react'
import { arrivalsToday } from '@/domain/attention'
import { selectSummary, selectVisibleShipments } from '@/domain/selectors'
import { OverviewMetrics, ShipmentOverview } from '@/features/overview'
import { AnalyticsReport } from '@/features/analytics'
import { CustomerHome } from '@/features/customer'
import { ShipmentDetail, ShipmentList } from '@/features/shipments'
import { selectNextEventAt, useWorkspaceStore } from '@/store/workspace-store'
import { Sidebar } from './layout/sidebar'
import { Topbar } from './layout/topbar'
import './layout/layout.css'
import { navigationFor } from './navigation'
import { useWorkspaceNavigation } from './use-workspace-navigation'

export function App() {
  const state = useWorkspaceStore()
  const shipments = useMemo(() => selectVisibleShipments(state), [state])
  const summary = selectSummary(shipments, state.cutoffAt)
  const selected = shipments.find((item) => item.shipment.id === state.selectedShipmentId)
  const identity = state.dataset.identities.find((item) => item.id === state.identityId)!
  const audience = identity.role
  const { view, setView, sidebarCollapsed, toggleSidebar } = state
  const pageTitle =
    view === 'shipment-detail'
      ? 'Detalle del envío'
      : (navigationFor(identity.role).find((item) => item.id === view)?.label ?? 'Vista general')
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
        items={navigationFor(identity.role)}
        onNavigate={setView}
        demoControls={
          identity.role === 'operations'
            ? {
                nextEventAt: selectNextEventAt(state),
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
          {view === 'overview' && audience === 'customer' && (
            <CustomerHome
              shipments={shipments}
              cutoffAt={state.cutoffAt}
              onOpenShipment={state.selectShipment}
            />
          )}
          {view === 'overview' && audience === 'operations' && (
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
            <ShipmentList
              shipments={shipments}
              cutoffAt={state.cutoffAt}
              audience={audience}
              onSelect={state.selectShipment}
            />
          )}
          {selected && view === 'shipment-detail' && (
            <ShipmentDetail
              key={selected.shipment.id}
              item={selected}
              cutoffAt={state.cutoffAt}
              audience={audience}
              onBack={() => setView('shipments')}
              onOpenShipment={state.selectShipment}
            />
          )}
          {view === 'analytics' && audience === 'operations' && (
            <AnalyticsReport
              key={state.identityId}
              shipments={shipments}
              identityId={state.identityId}
              cutoffAt={state.cutoffAt}
              datasetRevision={state.dataset.revision}
              onOpenShipment={state.selectShipment}
            />
          )}
        </main>
      </div>
    </div>
  )
}
