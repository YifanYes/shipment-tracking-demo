import { create } from 'zustand'

export type WorkspaceView = 'overview' | 'shipments' | 'analytics'

interface WorkspaceState {
  view: WorkspaceView
  setView: (view: WorkspaceView) => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

/** Presentation state only. Shipment and identity state arrive in phase 1. */
export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  view: 'overview',
  setView: (view) => set({ view }),
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}))
