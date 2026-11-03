import { useEffect } from 'react'
import { useWorkspaceStore, type WorkspaceState } from '@/store/workspace-store'

function workspacePath(state: WorkspaceState) {
  if (state.view === 'shipment-detail' && state.selectedShipmentId) {
    return `/shipments/${encodeURIComponent(state.selectedShipmentId)}`
  }
  if (state.view === 'shipments') return '/shipments'
  if (state.view === 'analytics') return '/analytics'
  return '/'
}

/**
 * Apply the URL through the same permission-checked store actions as any navigation.
 * Called before the first render too, so a direct link does not load another view first.
 */
export function syncWorkspaceWithLocation() {
  const url = new URL(window.location.href)
  const match = /^\/shipments\/([^/]+)\/?$/.exec(url.pathname)
  let shipmentId = url.searchParams.get('shipment')
  if (match?.[1]) {
    try {
      shipmentId = decodeURIComponent(match[1])
    } catch {
      shipmentId = null
    }
  }
  const store = useWorkspaceStore.getState()
  store.setView(
    url.pathname === '/analytics'
      ? 'analytics'
      : url.pathname.startsWith('/shipments') || shipmentId
        ? 'shipments'
        : 'overview',
  )
  if (shipmentId) store.selectShipment(shipmentId)
  // Replace invalid or legacy links rather than leaving an inaccessible detail URL.
  window.history.replaceState(null, '', workspacePath(useWorkspaceStore.getState()))
}

export function useWorkspaceNavigation() {
  useEffect(() => {
    let readingLocation = false
    const readLocation = () => {
      readingLocation = true
      syncWorkspaceWithLocation()
      readingLocation = false
    }
    readLocation()
    const unsubscribe = useWorkspaceStore.subscribe((next, previous) => {
      if (!readingLocation && workspacePath(next) !== workspacePath(previous)) {
        window.history.pushState(null, '', workspacePath(next))
      }
    })
    window.addEventListener('popstate', readLocation)
    return () => {
      unsubscribe()
      window.removeEventListener('popstate', readLocation)
    }
  }, [])
}
