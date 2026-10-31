import { create } from 'zustand'
import { phaseOneDataset, phaseOneScenario } from '@/data/phase-one'
import { selectVisibleShipments, type TrackingState } from '@/domain/selectors'
import { advanceScenario } from '@/simulation/advance'

export type WorkspaceView = 'overview' | 'shipments' | 'shipment-detail' | 'analytics'

export interface WorkspaceState extends TrackingState {
  view: WorkspaceView
  setView: (view: Exclude<WorkspaceView, 'shipment-detail'>) => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setIdentity: (identityId: string) => void
  selectShipment: (shipmentId: string | null) => void
  advanceDemo: () => void
  resetDemo: () => void
}

/** The factory keeps tests and future demo instances independent. */
export const createWorkspaceStore = () =>
  create<WorkspaceState>((set) => ({
    dataset: phaseOneDataset,
    identityId: phaseOneDataset.identities[0]!.id,
    cutoffAt: phaseOneDataset.referenceTime,
    selectedShipmentId: null,
    view: 'overview',
    setView: (view) =>
      set({
        view,
        selectedShipmentId: null,
      }),
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
        const identity = state.dataset.identities.find((item) => item.id === state.identityId)
        if (
          identity?.role !== 'operations' ||
          !selectVisibleShipments(state).some((item) =>
            phaseOneScenario.shipmentIds.includes(item.shipment.id),
          )
        )
          return {}
        return advanceScenario(state.dataset, phaseOneScenario)
      }),
    resetDemo: () =>
      set((state) => ({
        dataset: phaseOneDataset,
        cutoffAt: phaseOneDataset.referenceTime,
        selectedShipmentId: null,
        view: state.view === 'shipment-detail' ? 'shipments' : state.view,
      })),
  }))

export const useWorkspaceStore = createWorkspaceStore()
