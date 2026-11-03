import { create } from 'zustand'
import type { DemoSeed } from '@/domain/contracts'
import { demoSeed } from '@/data/scenarios'
import { selectVisibleShipments, type TrackingState } from '@/domain/selectors'
import { applyScheduledEvents, nextDemoStep } from '@/simulation/clock'
import { recordAction } from '@/domain/actions'
import { browserStorage, restoreSession, snapshotOf, STORAGE_KEY } from './persistence'

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
  /** Automatic advance through the same steps. Stops at the end, on reset or identity change. */
  playing: boolean
  setPlaying: (playing: boolean) => void
  /** Record a pending recommendation of a visible shipment. Operations only. */
  recordAction: (shipmentId: string, actionId: string, message?: string) => void
  resetDemo: () => void
}

export interface WorkspaceStoreOptions {
  /** Versioned persistence. Omitted in tests that need an isolated store. */
  storage?: Storage | null
}

export function selectNextStep(state: Pick<WorkspaceState, 'seed' | 'dataset' | 'cutoffAt'>) {
  return nextDemoStep(state.dataset, state.seed.steps, state.cutoffAt)
}

/** The factory keeps tests and future demo instances independent. */
export function createWorkspaceStore(
  seed: DemoSeed = demoSeed,
  { storage = null }: WorkspaceStoreOptions = {},
) {
  let saved: string | null = null
  try {
    saved = storage?.getItem(STORAGE_KEY) ?? null
  } catch {
    saved = null
  }
  const restored = restoreSession(seed, saved)
  // An incompatible snapshot is discarded so the next save starts clean.
  if (saved && !restored) storage?.removeItem(STORAGE_KEY)
  const store = create<WorkspaceState>((set) => ({
    seed,
    dataset: restored?.dataset ?? seed.dataset,
    identityId: restored?.identityId ?? seed.dataset.identities[0]!.id,
    cutoffAt: restored?.cutoffAt ?? seed.dataset.referenceTime,
    selectedShipmentId: null,
    view: 'overview',
    setView: (view) =>
      set((state) => ({
        view: view === 'analytics' && !isOperations(state) ? 'overview' : view,
        selectedShipmentId: null,
      })),
    sidebarCollapsed: restored?.sidebarCollapsed ?? false,
    toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    setIdentity: (identityId) =>
      set((state) =>
        state.dataset.identities.some((identity) => identity.id === identityId)
          ? { identityId, selectedShipmentId: null, view: 'overview', playing: false }
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
        if (!isOperations(state) || !next) return { playing: false }
        return {
          cutoffAt: next.at,
          dataset: applyScheduledEvents(state.dataset, state.seed.scenarios, next.at),
        }
      }),
    playing: false,
    setPlaying: (playing) =>
      set((state) => ({
        playing: playing && isOperations(state) && selectNextStep(state) !== null,
      })),
    recordAction: (shipmentId, actionId, message) =>
      set((state) => {
        const view = selectVisibleShipments(state).find((item) => item.shipment.id === shipmentId)
        if (!view || !isOperations(state)) return {}
        const dataset = recordAction({
          dataset: state.dataset,
          view,
          actionId,
          actorIdentityId: state.identityId,
          at: state.cutoffAt,
          message,
        })
        return dataset === state.dataset ? {} : { dataset }
      }),
    resetDemo: () =>
      set((state) => ({
        playing: false,
        dataset: state.seed.dataset,
        cutoffAt: state.seed.dataset.referenceTime,
        selectedShipmentId: null,
        view: state.view === 'shipment-detail' ? 'shipments' : state.view,
      })),
  }))
  if (storage)
    store.subscribe((state, previous) => {
      if (
        state.identityId === previous.identityId &&
        state.cutoffAt === previous.cutoffAt &&
        state.dataset === previous.dataset &&
        state.sidebarCollapsed === previous.sidebarCollapsed
      )
        return
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(snapshotOf(state)))
      } catch {
        // Full or blocked storage: the demo keeps working in memory.
      }
    })
  return store
}

function isOperations(state: TrackingState) {
  return (
    state.dataset.identities.find((identity) => identity.id === state.identityId)?.role ===
    'operations'
  )
}

export const useWorkspaceStore = createWorkspaceStore(demoSeed, { storage: browserStorage() })
