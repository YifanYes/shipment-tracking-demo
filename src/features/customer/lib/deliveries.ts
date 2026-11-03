import type { ShipmentView } from '@/domain/contracts'
import { deliveredAt, expectedArrival } from '@/features/shipments'

export const RECENT_DELIVERIES_LIMIT = 5

/** Open shipments by expected arrival; those without evidence go last, by commitment. */
export function upcomingDeliveries(views: readonly ShipmentView[]) {
  const arrival = (view: ShipmentView) => expectedArrival(view.projection.eta)
  return views
    .filter((view) => view.projection.lifecycle !== 'delivered')
    .sort((a, b) => {
      const aAt = arrival(a)
      const bAt = arrival(b)
      if (aAt && bAt) return Date.parse(aAt) - Date.parse(bAt)
      if (aAt || bAt) return aAt ? -1 : 1
      return Date.parse(a.shipment.committedDeliveryAt) - Date.parse(b.shipment.committedDeliveryAt)
    })
}

/** Latest confirmed deliveries first. */
export function recentDeliveries(views: readonly ShipmentView[], limit = RECENT_DELIVERIES_LIMIT) {
  const time = (view: ShipmentView) =>
    Date.parse(deliveredAt(view) ?? view.shipment.committedDeliveryAt)
  return views
    .filter((view) => view.projection.lifecycle === 'delivered')
    .sort((a, b) => time(b) - time(a))
    .slice(0, limit)
}
