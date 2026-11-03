import type { DemoDataset, OperatorEvent, Shipment } from '@/domain/contracts'
import { makeShipment, type LanePlan } from '@/data/scenarios/builders'
import { accounts, identities, locations, operators } from '@/data/scenarios/network'
import { selectVisibleShipments } from '@/domain/selectors'

/** Small report fixture. Times are hours after T0; every expected value is computed by hand. */
export const T0 = Date.parse('2026-08-01T00:00:00.000Z')
export const iso = (hours: number) => new Date(T0 + hours * 3_600_000).toISOString()
export const reportCutoff = iso(100)

const road = (originSiteId: string, destinationLocationId: string): LanePlan => ({
  originSiteId,
  destinationLocationId,
  roadOperatorId: 'operator-iberia',
})

function shipment(id: string, lane: LanePlan, committedHours: number, createdHours = 0): Shipment {
  return makeShipment({
    id,
    reference: id.toUpperCase(),
    accountId: 'account-norte',
    lane,
    createdAt: iso(createdHours),
    committedDeliveryAt: iso(committedHours),
    withRoutes: false,
  })
}

const sea = (originSiteId: string): LanePlan => ({
  originSiteId,
  destinationLocationId: 'destination-adana',
  originPortId: 'port-valencia',
  roadOperatorId: 'operator-iberia',
})

export const fixtureShipments = {
  /** Delivered on time, pickup 2 h. */
  a: shipment('shipment-fx-a', road('site-madrid', 'destination-valencia'), 10),
  /** Delivered 4 h late, pickup 4 h. */
  b: shipment('shipment-fx-b', road('site-madrid', 'destination-valencia'), 10),
  /** Delivered 16 h late, pickup 20 h. */
  c: shipment('shipment-fx-c', road('site-zaragoza', 'destination-valencia'), 10),
  /** Not collected at the cutoff: open pickup wait of 100 h, overdue. */
  d: shipment('shipment-fx-d', road('site-zaragoza', 'destination-valencia'), 10),
  /** Sea and customs, on time: pickup 1 h, port dwell 40 h, customs 10 h. */
  e: shipment('shipment-fx-e', sea('site-madrid'), 80),
  /** At the port at the cutoff: open dwell of 10 h. */
  f: shipment('shipment-fx-f', sea('site-barcelona'), 200, 70),
}

let sequence = 0
function event(
  target: Shipment,
  legSequence: number,
  rawCode: string,
  hours: number,
  payload: OperatorEvent['payload'] = {},
): OperatorEvent {
  const leg = target.legs.find((item) => item.sequence === legSequence)!
  sequence += 1
  return {
    id: `event-fx-${sequence}`,
    shipmentId: target.id,
    legId: leg.id,
    operatorId: leg.operatorId,
    rawCode,
    rawMessage: rawCode,
    payload,
    occurredAt: iso(hours),
    receivedAt: iso(hours),
  }
}

const { a, b, c, e, f } = fixtureShipments
const fixtureEvents: OperatorEvent[] = [
  event(a, 1, 'PICKED_UP', 2),
  event(a, 1, 'DELIVERED', 8),
  event(b, 1, 'PICKED_UP', 4),
  event(b, 1, 'DELIVERED', 14),
  event(c, 1, 'PICKED_UP', 20),
  event(c, 1, 'DELIVERED', 26),
  event(e, 1, 'PICKED_UP', 1),
  event(e, 1, 'DELIVERED', 3),
  event(e, 2, 'GATE_IN', 4),
  event(e, 2, 'VESSEL_DEPARTED', 44),
  event(e, 2, 'VESSEL_ARRIVED', 60),
  event(e, 2, 'DISCHARGED', 62),
  event(e, 3, 'ENTRY_LODGED', 63),
  event(e, 3, 'CUSTOMS_RELEASED', 73),
  event(e, 3, 'TRUCK_DEPARTED', 74),
  event(e, 3, 'POD', 76),
  event(f, 1, 'PICKED_UP', 75),
  event(f, 1, 'DELIVERED', 89),
  event(f, 2, 'GATE_IN', 90),
]

export const reportDataset: DemoDataset = {
  revision: 1,
  referenceTime: iso(0),
  accounts,
  identities,
  locations,
  operators,
  shipments: Object.values(fixtureShipments),
  events: fixtureEvents,
  documents: [],
}

export const reportViews = selectVisibleShipments({
  dataset: reportDataset,
  identityId: 'operations-network',
  cutoffAt: reportCutoff,
  selectedShipmentId: null,
})
