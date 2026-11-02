import type { DemoIdentity, Shipment } from './contracts'

export function canViewShipment(identity: DemoIdentity, shipment: Shipment): boolean {
  return identity.role === 'customer'
    ? identity.accountId === shipment.accountId
    : identity.allowedOriginSiteIds.includes(shipment.originSiteId) &&
        identity.allowedAccountIds.includes(shipment.accountId)
}
