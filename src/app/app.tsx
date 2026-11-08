import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { arrivalsToday } from '@/domain/attention'
import { selectSummary, selectVisibleShipments } from '@/domain/selectors'
import { OverviewMetrics, ShipmentOverview, ShipmentRouteMap } from '@/features/overview'
import { AnalyticsReport } from '@/features/analytics'
import { CustomerHome } from '@/features/customer'
import { ShipmentDetail, ShipmentList } from '@/features/shipments'
import { shipmentChanges } from '@/domain/changes'
import { Toaster, toastManager } from '@/shared/ui/toast'
import { selectNextStep, useWorkspaceStore, type WorkspaceView } from '@/store/workspace-store'
import { PLAY_STEP_MS, stepLabel } from '@/simulation/clock'
import { announceStep } from './demo-step-toast'
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
  const nextStep = selectNextStep(state)
  const audience = identity.role
  const { view, setView, sidebarCollapsed, toggleSidebar } = state
  const pageTitle =
    view === 'shipment-detail'
      ? 'Detalle del envío'
      : (navigationFor(identity.role).find((item) => item.id === view)?.label ?? 'Vista general')
  useWorkspaceNavigation()
  const [listResults, setListResults] = useState<number | null>(null)
  // The list and the report stay mounted once opened, so a detail does not lose their state.
  const [opened, setOpened] = useState<readonly WorkspaceView[]>([view])
  if (!opened.includes(view)) setOpened([...opened, view])

  const location = useRef({
    view,
    selectedShipmentId: state.selectedShipmentId,
    identityId: state.identityId,
  })
  useEffect(() => {
    const previous = location.current
    location.current = {
      view,
      selectedShipmentId: state.selectedShipmentId,
      identityId: state.identityId,
    }
    const samePage =
      previous.view === view && previous.selectedShipmentId === state.selectedShipmentId
    if (samePage && previous.identityId === state.identityId) return
    window.scrollTo(0, 0)
    // The detail focuses its own heading; the identity selector keeps the focus while in use.
    if (!samePage && view !== 'shipment-detail' && previous.identityId === state.identityId)
      document.getElementById('main-content')?.focus({ preventScroll: true })
  }, [view, state.selectedShipmentId, state.identityId])

  /** Manual and automatic advance share the same step, toast and end condition. */
  const advance = useCallback(() => {
    const before = useWorkspaceStore.getState()
    const step = selectNextStep(before)
    if (!step) return before.setPlaying(false)
    const previous = selectVisibleShipments(before)
    before.advanceDemo()
    const after = useWorkspaceStore.getState()
    const views = selectVisibleShipments(after)
    announceStep(step, shipmentChanges(previous, views), views)
    if (!selectNextStep(after)) after.setPlaying(false)
  }, [])

  useEffect(() => {
    if (!state.playing) return
    const timer = window.setInterval(advance, PLAY_STEP_MS)
    return () => window.clearInterval(timer)
  }, [advance, state.playing])

  useEffect(() => {
    document.title = `${selected?.shipment.reference ?? pageTitle} | Atlas`
  }, [pageTitle, selected?.shipment.reference])

  return (
    <Toaster>
      <div className="workspace">
        <a className="skip-link" href="#main-content">
          Saltar al contenido
        </a>
        <Sidebar
          view={view}
          collapsed={sidebarCollapsed}
          items={navigationFor(identity.role)}
          onNavigate={setView}
          demoControls={{
            nextStep: nextStep && { ...nextStep, label: stepLabel(nextStep, shipments) },
            playing: state.playing,
            onTogglePlay: () => {
              if (state.playing) return state.setPlaying(false)
              state.setPlaying(true)
              advance()
            },
            onAdvance: advance,
            onReset: () => {
              toastManager.close()
              state.resetDemo()
            },
          }}
        />

        <div className="main-shell">
          <Topbar
            title={pageTitle}
            count={view === 'shipments' ? (listResults ?? shipments.length) : null}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={toggleSidebar}
            identities={state.dataset.identities}
            identityId={state.identityId}
            onIdentityChange={(id) => {
              toastManager.close()
              state.setIdentity(id)
            }}
          />

          <main
            id="main-content"
            className="main-content"
            aria-labelledby="page-title"
            tabIndex={-1}
          >
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

            {opened.includes('shipments') && (
              <div hidden={view !== 'shipments'}>
                <ShipmentList
                  key={state.identityId}
                  shipments={shipments}
                  cutoffAt={state.cutoffAt}
                  audience={audience}
                  onSelect={state.selectShipment}
                  onResultsChange={setListResults}
                />
              </div>
            )}
            {selected && view === 'shipment-detail' && (
              <ShipmentDetail
                key={selected.shipment.id}
                item={selected}
                cutoffAt={state.cutoffAt}
                audience={audience}
                backLabel={state.backView === 'analytics' ? 'Volver al reporte' : 'Volver a envíos'}
                routeMap={
                  selected.projection.lifecycle === 'delivered' ? undefined : (
                    <ShipmentRouteMap item={selected} cutoffAt={state.cutoffAt} />
                  )
                }
                onBack={() => setView(state.backView)}
                onOpenShipment={state.selectShipment}
                onRecordAction={(actionId, message) =>
                  state.recordAction(selected.shipment.id, actionId, message)
                }
                actorName={(id) =>
                  state.dataset.identities.find((item) => item.id === id)?.name ?? id
                }
              />
            )}
            {opened.includes('analytics') && audience === 'operations' && (
              <div hidden={view !== 'analytics'}>
                <AnalyticsReport
                  key={state.identityId}
                  shipments={shipments}
                  identityId={state.identityId}
                  cutoffAt={state.cutoffAt}
                  datasetRevision={state.dataset.revision}
                  onOpenShipment={state.selectShipment}
                />
              </div>
            )}
          </main>
        </div>
      </div>
    </Toaster>
  )
}
