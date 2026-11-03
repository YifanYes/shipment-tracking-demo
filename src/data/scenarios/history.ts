import type { EntityId, OperatorEvent, Shipment } from '@/domain/contracts'
import {
  at,
  eventsFor,
  hours,
  makeShipment,
  seaDestinations,
  type DataPart,
  type LanePlan,
} from './builders'
import { accounts, locations } from './network'

/** Deterministic PRNG (mulberry32). The history never depends on Math.random or the real clock. */
export function createRandom(seed: number) {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
  return {
    next,
    between: (min: number, max: number) => min + (max - min) * next(),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
  }
}

/**
 * Deliberate patterns, each with comparison samples that share operators:
 * - Valencia port: longer gate-in → departure dwell than Barcelona and Algeciras, same carrier.
 * - Felixstowe: longer customs clearance than Tanger Med and Mersin, same customs agent.
 * - Zaragoza platform: later pickups than Madrid and Martorell, with both road operators.
 * Road operators share lanes and transit times, so no result is attributable to them.
 */
export const historyPatterns = {
  pickupHours: { 'site-madrid': [3, 8], 'site-barcelona': [3, 8], 'site-zaragoza': [14, 26] },
  portDwellHours: {
    'port-valencia': [48, 80],
    'port-barcelona': [18, 36],
    'port-algeciras': [10, 22],
  },
  customsHours: {
    'port-felixstowe': [40, 72],
    'port-mersin': [16, 30],
    'port-tanger-med': [8, 18],
  },
} as const satisfies Record<string, Record<EntityId, readonly [number, number]>>

const roadOperators = ['operator-iberia', 'operator-cierzo'] as const

type LaneTemplate = Omit<LanePlan, 'roadOperatorId' | 'lastMileOperatorId'>

const lanes: readonly (LaneTemplate & { weight: number })[] = [
  { originSiteId: 'site-madrid', destinationLocationId: 'destination-valencia', weight: 6 },
  { originSiteId: 'site-madrid', destinationLocationId: 'destination-sevilla', weight: 5 },
  { originSiteId: 'site-madrid', destinationLocationId: 'destination-bilbao', weight: 4 },
  { originSiteId: 'site-madrid', destinationLocationId: 'destination-a-coruna', weight: 3 },
  { originSiteId: 'site-barcelona', destinationLocationId: 'destination-valencia', weight: 5 },
  { originSiteId: 'site-barcelona', destinationLocationId: 'destination-murcia', weight: 3 },
  { originSiteId: 'site-barcelona', destinationLocationId: 'destination-sevilla', weight: 3 },
  { originSiteId: 'site-zaragoza', destinationLocationId: 'destination-bilbao', weight: 4 },
  { originSiteId: 'site-zaragoza', destinationLocationId: 'destination-valencia', weight: 4 },
  { originSiteId: 'site-zaragoza', destinationLocationId: 'destination-malaga', weight: 3 },
  {
    originSiteId: 'site-madrid',
    destinationLocationId: 'destination-adana',
    originPortId: 'port-valencia',
    weight: 3,
  },
  {
    originSiteId: 'site-madrid',
    destinationLocationId: 'destination-birmingham',
    originPortId: 'port-valencia',
    weight: 3,
  },
  {
    originSiteId: 'site-madrid',
    destinationLocationId: 'destination-milano',
    originPortId: 'port-valencia',
    weight: 3,
  },
  {
    originSiteId: 'site-madrid',
    destinationLocationId: 'destination-casablanca',
    originPortId: 'port-algeciras',
    weight: 4,
  },
  {
    originSiteId: 'site-barcelona',
    destinationLocationId: 'destination-adana',
    originPortId: 'port-barcelona',
    weight: 3,
  },
  {
    originSiteId: 'site-barcelona',
    destinationLocationId: 'destination-birmingham',
    originPortId: 'port-barcelona',
    weight: 3,
  },
  {
    originSiteId: 'site-barcelona',
    destinationLocationId: 'destination-milano',
    originPortId: 'port-barcelona',
    weight: 3,
  },
  {
    originSiteId: 'site-zaragoza',
    destinationLocationId: 'destination-casablanca',
    originPortId: 'port-valencia',
    weight: 2,
  },
  {
    originSiteId: 'site-zaragoza',
    destinationLocationId: 'destination-milano',
    originPortId: 'port-barcelona',
    weight: 2,
  },
  {
    originSiteId: 'site-zaragoza',
    destinationLocationId: 'destination-birmingham',
    originPortId: 'port-algeciras',
    weight: 2,
  },
]

const coordinates = new Map(locations.map((location) => [location.id, location.coordinates!]))

/** Straight-line distance between two locations, in km. */
function distance(from: EntityId, to: EntityId) {
  const a = coordinates.get(from)!
  const b = coordinates.get(to)!
  const rad = Math.PI / 180
  const h =
    Math.sin(((b[1] - a[1]) * rad) / 2) ** 2 +
    Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(((b[0] - a[0]) * rad) / 2) ** 2
  return 12_742 * Math.asin(Math.sqrt(h))
}

/** Sea distances along the operator itineraries are longer than the straight line. */
const seaFactor = (from: EntityId, to: EntityId) =>
  to === 'port-felixstowe' ? 1.6 : from === 'port-algeciras' ? 1.1 : 1.25

const roadHours = (from: EntityId, to: EntityId) => (distance(from, to) * 1.25) / 70
const seaHours = (from: EntityId, to: EntityId) =>
  (distance(from, to) * seaFactor(from, to)) / (16 * 1.852)

export const HISTORY_SIZE = 150
const DAY = 24

function generate(seed = 20261031): DataPart {
  const random = createRandom(seed)
  const totalWeight = lanes.reduce((sum, lane) => sum + lane.weight, 0)
  const pickLane = () => {
    let roll = random.next() * totalWeight
    for (const lane of lanes) {
      roll -= lane.weight
      if (roll < 0) return lane
    }
    return lanes.at(-1)!
  }
  const shipments: Shipment[] = []
  const events: OperatorEvent[] = []

  for (let index = 0; index < HISTORY_SIZE; index++) {
    const template = pickLane()
    const international = !!template.originPortId
    const roadOperatorId = random.pick(roadOperators)
    const lane: LanePlan = {
      ...template,
      roadOperatorId,
      lastMileOperatorId: random.pick(roadOperators),
    }
    // International lanes need up to 16 days; every historical shipment ends before the reference.
    const latestStart = international ? 19 * DAY : 3 * DAY
    const createdMinutes = -hours(random.between(latestStart, 90 * DAY))
    const pickup = random.between(
      ...historyPatterns.pickupHours[lane.originSiteId as 'site-madrid'],
    )
    const sea = seaDestinations[lane.destinationLocationId]

    // Nominal plan with typical waits; it sets the commitment.
    let nominal = 6 + roadHours(lane.originSiteId, lane.originPortId ?? lane.destinationLocationId)
    if (international && sea) {
      nominal += 30 + seaHours(lane.originPortId!, sea.port) + 6 + (sea.customs ? 24 : 2)
      nominal += roadHours(sea.port, lane.destinationLocationId) + 3
    }
    const committedHours = Math.ceil(nominal * 1.2 + 12)
    const id = `shipment-h-${String(index + 1).padStart(3, '0')}`
    const country = locations.find((item) => item.id === lane.destinationLocationId)!.countryCode
    const shipment = makeShipment({
      id,
      reference: `ATL-${country}-${String(1001 + index)}`,
      accountId: random.pick(accounts).id,
      lane,
      createdAt: at(createdMinutes),
      committedDeliveryAt: at(createdMinutes + hours(committedHours)),
      withRoutes: false,
    })
    const event = eventsFor(shipment)
    let clock = createdMinutes + hours(pickup)
    const step = (value: number) => (clock += hours(value))
    const eta = (key: string, extraHours: number) => ({ [key]: at(clock + hours(extraHours)) })

    const firstTo = lane.originPortId ?? lane.destinationLocationId
    const firstTransit = roadHours(lane.originSiteId, firstTo) * random.between(0.95, 1.2)
    const iberia = roadOperatorId === 'operator-iberia'
    events.push(
      event(1, iberia ? 'PICKED_UP' : 'REC', clock, {
        message: iberia ? 'Mercancía recogida.' : 'RECOGIDA EFECTUADA',
        locationId: lane.originSiteId,
      }),
    )
    step(0.5)
    events.push(
      event(1, iberia ? 'ON_ROUTE' : 'TRA', clock, {
        message: iberia ? 'En ruta.' : 'EN TRANSITO',
        payload: international ? {} : eta(iberia ? 'arrivalAt' : 'llegadaPrevista', firstTransit),
      }),
    )
    step(firstTransit)
    if (!international || !sea) {
      events.push(
        event(1, iberia ? 'OUT_FOR_DELIVERY' : 'REP', clock - hours(1), {
          message: iberia ? 'En reparto.' : 'EN REPARTO',
        }),
      )
      events.push(
        event(1, iberia ? 'DELIVERED' : 'ENT', clock, {
          message: iberia ? 'Entrega confirmada.' : 'ENTREGADO',
          locationId: lane.destinationLocationId,
        }),
      )
      shipments.push(shipment)
      continue
    }
    const port = lane.originPortId!
    events.push(
      event(1, iberia ? 'DELIVERED' : 'ENT', clock, {
        message: iberia ? 'Entrega confirmada en la terminal.' : 'ENTREGADO TERMINAL',
        locationId: port,
      }),
    )
    step(0.5)
    events.push(event(2, 'GATE_IN', clock, { message: 'Container gated in.', locationId: port }))
    const dwell = random.between(...historyPatterns.portDwellHours[port as 'port-valencia'])
    step(dwell - 4)
    events.push(
      event(2, 'LOADED_ON_VESSEL', clock, {
        message: 'Container loaded on board.',
        locationId: port,
      }),
    )
    if (index % 50 === 7)
      events.push(event(2, 'VGM_PENDING', clock + 30, { message: 'VGM pending carrier review.' }))
    step(4)
    const sailing = seaHours(port, sea.port) * random.between(0.95, 1.2)
    const plannedRemaining =
      sailing + 6 + (sea.customs ? 24 : 2) + roadHours(sea.port, lane.destinationLocationId) + 3
    events.push(
      event(2, 'VESSEL_DEPARTED', clock, {
        message: 'Vessel departed.',
        payload: eta('eta', plannedRemaining),
        locationId: port,
      }),
    )
    const delayed = random.next() < 0.15
    if (delayed) {
      const extra = random.between(12, 36)
      events.push(
        event(2, 'DELAY_NOTICE', clock + hours(sailing / 2), {
          message: 'Delay notice: revised ETA.',
          payload: { eta: at(clock + hours(plannedRemaining + extra)) },
        }),
      )
      step(extra)
    }
    step(sailing)
    events.push(
      event(2, 'VESSEL_ARRIVED', clock, { message: 'Vessel arrived.', locationId: sea.port }),
    )
    step(random.between(3, 8))
    events.push(
      event(2, 'DISCHARGED', clock, { message: 'Container discharged.', locationId: sea.port }),
    )
    const lastMile = roadHours(sea.port, lane.destinationLocationId) * random.between(0.95, 1.2)
    if (sea.customs) {
      step(random.between(1, 3))
      events.push(
        event(3, 'ENTRY_LODGED', clock, {
          message: 'Declaración presentada.',
          locationId: sea.port,
        }),
      )
      const customs = random.between(...historyPatterns.customsHours[sea.port as 'port-mersin'])
      if (random.next() < 0.12)
        events.push(
          event(3, 'CUSTOMS_HOLD', clock + hours(customs / 3), {
            message: 'Retención para inspección documental.',
            locationId: sea.port,
          }),
        )
      step(customs)
      events.push(
        event(3, 'CUSTOMS_RELEASED', clock, {
          message: 'Despacho concluido.',
          payload: eta('deliveryEta', 4 + lastMile),
          locationId: sea.port,
        }),
      )
      step(random.between(1, 5))
      events.push(
        event(3, 'TRUCK_DEPARTED', clock, { message: 'Camión en ruta.', locationId: sea.port }),
      )
      step(lastMile)
      events.push(event(3, 'OUT_FOR_DELIVERY', clock - hours(1), { message: 'En reparto.' }))
      events.push(
        event(3, 'POD', clock, {
          message: 'Entrega firmada.',
          locationId: lane.destinationLocationId,
        }),
      )
    } else {
      const lastIberia = lane.lastMileOperatorId === 'operator-iberia'
      step(random.between(1, 4))
      events.push(
        event(3, lastIberia ? 'PICKED_UP' : 'REC', clock, {
          message: lastIberia ? 'Mercancía recogida.' : 'RECOGIDA EFECTUADA',
          locationId: sea.port,
        }),
      )
      step(0.5)
      events.push(
        event(3, lastIberia ? 'ON_ROUTE' : 'TRA', clock, {
          message: lastIberia ? 'En ruta.' : 'EN TRANSITO',
        }),
      )
      step(lastMile)
      events.push(
        event(3, lastIberia ? 'DELIVERED' : 'ENT', clock, {
          message: lastIberia ? 'Entrega confirmada.' : 'ENTREGADO',
          locationId: lane.destinationLocationId,
        }),
      )
    }
    shipments.push(shipment)
  }
  return { shipments, events, documents: [] }
}

/** Historical shipments over the 90 days before the reference time. */
export const buildHistory = generate
