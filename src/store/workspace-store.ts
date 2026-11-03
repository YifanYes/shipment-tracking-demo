import { create } from 'zustand'
import type { DemoSeed } from '@/domain/contracts'
import { demoSeed } from '@/data/scenarios'
import { selectVisibleShipments, type TrackingState } from '@/domain/selectors'
import { applyScheduledEvents, nextDemoStep } from '@/simulation/clock'

export type WorkspaceView = 'overview' | 'shipments' | 'shipment-detail' | 'analytics'

export interface WorkspaceState extends TrackingState {
  seed: DemoSeed
  view: WorkspaceView
  setView: (view: Exclude<WorkspaceView, 'shipment-detail'>) => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setIdentity: (identityId: string) => void
  selectShipment: (shipmentId: string | null) => void
  /** Move the clock to the next demo step and release its events. Operations only. */
  advanceDemo: () => void
  resetDemo: () => void
}

export function selectNextStep(state: Pick<WorkspaceState, 'seed' | 'dataset' | 'cutoffAt'>) {
  return nextDemoStep(state.dataset, state.seed.steps, state.cutoffAt)
}

/** The factory keeps tests and future demo instances independent. */
export const createWorkspaceStore = (seed: DemoSeed = demoSeed) =>
  create<WorkspaceState>((set) => ({
    seed,
    dataset: seed.dataset,
    identityId: seed.dataset.identities[0]!.id,
    cutoffAt: seed.dataset.referenceTime,
    selectedShipmentId: null,
    view: 'overview',
    setView: (view) =>
      set((state) => ({
        view: view === 'analytics' && !isOperations(state) ? 'overview' : view,
        selectedShipmentId: null,
      })),
    sidebarCollapsed: false,
    toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    setIdentity: (identityId) =>
      set((state) =>
        state.dataset.identities.some((identity) => identity.id === identityId)
          ? { identityId, selectedShipmentId: null, view: 'overview' }
          : {},
      ),
    selectShipment: (shipmentId) =>
      set((state) => {
        const allowed = selectVisibleShipments(state).some(
          (item) => item.shipment.id === shipmentId,
        )
        return {
          selectedShipmentId: allowed ? shipmentId : null,
          view: allowed
            ? 'shipment-detail'
            : state.view === 'shipment-detail'
              ? 'shipments'
              : state.view,
        }
      }),
    advanceDemo: () =>
      set((state) => {
        const next = selectNextStep(state)
        if (!isOperations(state) || !next) return {}
        return {
          cutoffAt: next.at,
          dataset: applyScheduledEvents(state.dataset, state.seed.scenarios, next.at),
        }
      }),
    resetDemo: () =>
      set((state) => ({
        dataset: state.seed.dataset,
        cutoffAt: state.seed.dataset.referenceTime,
        selectedShipmentId: null,
        view: state.view === 'shipment-detail' ? 'shipments' : state.view,
      })),
  }))

function isOperations(state: TrackingState) {
  return (
    state.dataset.identities.find((identity) => identity.id === state.identityId)?.role ===
    'operations'
  )
}

export const useWorkspaceStore = createWorkspaceStore()
