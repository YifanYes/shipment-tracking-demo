import type {
  EntityId,
  IsoDateTime,
  JsonValue,
  LegStage,
  OperatorEvent,
  ScheduledEvent,
  Shipment,
  ShipmentDocument,
  ShipmentLeg,
  TransportMode,
} from '@/domain/contracts'
import { referenceTime } from './network'
import { routeFor } from './routes'

const reference = Date.parse(referenceTime)

/** ISO time at a number of minutes from the reference time (negative = before). */
export const at = (minutes: number): IsoDateTime =>
  new Date(reference + Math.round(minutes) * 60_000).toISOString()

export const hours = (value: number) => value * 60

export const milestones = {
  road: ['planned', 'collected', 'in_transit', 'out_for_delivery', 'completed'],
  roadToPort: ['planned', 'collected', 'in_transit', 'completed'],
  sea: [
    'planned',
    'at_origin_terminal',
    'loaded',
    'in_transit',
    'at_destination_terminal',
    'completed',
  ],
  roadWithCustoms: [
    'planned',
    'customs',
    'collected',
    'in_transit',
    'out_for_delivery',
    'completed',
  ],
} as const satisfies Record<string, readonly LegStage[]>

export interface DestinationPlan {
  /** Destination port for international shipments. */
  port: EntityId
  customs: boolean
}

/** Destinations reached by sea, with their arrival port and whether they require customs. */
export const seaDestinations: Readonly<Record<EntityId, DestinationPlan>> = {
  'destination-casablanca': { port: 'port-tanger-med', customs: true },
  'destination-milano': { port: 'port-genova', customs: false },
  'destination-adana': { port: 'port-mersin', customs: true },
  'destination-birmingham': { port: 'port-felixstowe', customs: true },
}

export interface LanePlan {
  originSiteId: EntityId
  destinationLocationId: EntityId
  roadOperatorId: EntityId
  /** Origin port for international lanes. */
  originPortId?: EntityId
  lastMileOperatorId?: EntityId
}

interface LegDraft {
  mode: TransportMode
  operatorId: EntityId
  from: EntityId
  to: EntityId
  milestones: readonly LegStage[]
}

export function laneLegs(plan: LanePlan): LegDraft[] {
  const sea = seaDestinations[plan.destinationLocationId]
  if (!sea || !plan.originPortId)
    return [
      {
        mode: 'road',
        operatorId: plan.roadOperatorId,
        from: plan.originSiteId,
        to: plan.destinationLocationId,
        milestones: milestones.road,
      },
    ]
  return [
    {
      mode: 'road',
      operatorId: plan.roadOperatorId,
      from: plan.originSiteId,
      to: plan.originPortId,
      milestones: milestones.roadToPort,
    },
    {
      mode: 'sea',
      operatorId: 'operator-boreal',
      from: plan.originPortId,
      to: sea.port,
      milestones: milestones.sea,
    },
    {
      mode: 'road',
      operatorId: sea.customs
        ? 'operator-puente'
        : (plan.lastMileOperatorId ?? plan.roadOperatorId),
      from: sea.port,
      to: plan.destinationLocationId,
      milestones: sea.customs ? milestones.roadWithCustoms : milestones.road,
    },
  ]
}

const suffixOf = (shipmentId: EntityId) => shipmentId.replace(/^shipment-/, '')

export function makeShipment(input: {
  id: EntityId
  reference: string
  accountId: EntityId
  lane: LanePlan
  createdAt: IsoDateTime
  committedDeliveryAt: IsoDateTime
  documentIds?: readonly EntityId[]
  withRoutes?: boolean
}): Shipment {
  const suffix = suffixOf(input.id)
  const legs = laneLegs(input.lane).map((draft, index): ShipmentLeg => {
    const route = input.withRoutes === false ? undefined : routeFor(draft.from, draft.to)
    return {
      id: `leg-${suffix}-${index + 1}`,
      sequence: index + 1,
      mode: draft.mode,
      operatorId: draft.operatorId,
      originLocationId: draft.from,
      destinationLocationId: draft.to,
      milestones: draft.milestones,
      ...(route ? { route } : {}),
    }
  })
  return {
    id: input.id,
    reference: input.reference,
    accountId: input.accountId,
    originSiteId: input.lane.originSiteId,
    destinationLocationId: input.lane.destinationLocationId,
    createdAt: input.createdAt,
    committedDeliveryAt: input.committedDeliveryAt,
    legs,
    documentIds: input.documentIds ?? [],
  }
}

export interface EventOptions {
  message: string
  payload?: { readonly [key: string]: JsonValue }
  locationId?: EntityId
  /** Minutes after the fact when the operator message arrived. Defaults to 2. */
  receivedAfter?: number
  /** Explicit ID suffix when the same code repeats on a leg. */
  key?: string
}

/** Event builder bound to a shipment. `minutes` is the time of the fact from the reference. */
export function eventsFor(shipment: Shipment) {
  const suffix = suffixOf(shipment.id)
  return (sequence: number, rawCode: string, minutes: number, options: EventOptions) => {
    const leg = shipment.legs.find((item) => item.sequence === sequence)
    if (!leg) throw new Error(`Leg ${sequence} missing in ${shipment.id}`)
    const key = options.key ?? rawCode.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const event: OperatorEvent = {
      id: `event-${suffix}-${sequence}-${key}`,
      shipmentId: shipment.id,
      legId: leg.id,
      operatorId: leg.operatorId,
      rawCode,
      rawMessage: options.message,
      payload: options.payload ?? {},
      occurredAt: at(minutes),
      receivedAt: at(minutes + (options.receivedAfter ?? 2)),
      ...(options.locationId ? { locationId: options.locationId } : {}),
    }
    return event
  }
}

/** A scheduled event is received exactly when the clock releases it. */
export function scheduled(offsetMinutes: number, event: OperatorEvent): ScheduledEvent {
  if (offsetMinutes <= 0) throw new Error(`Scheduled offset must be positive: ${event.id}`)
  if (Date.parse(event.occurredAt) > Date.parse(at(offsetMinutes)))
    throw new Error(`Scheduled event happens after its release: ${event.id}`)
  return { offsetMinutes, event: { ...event, receivedAt: at(offsetMinutes) } }
}

export function document(
  shipment: Shipment,
  kind: ShipmentDocument['kind'],
  name: string,
  uploadedAt?: IsoDateTime,
): ShipmentDocument {
  const id = `document-${suffixOf(shipment.id)}-${kind.replace('_', '-')}`
  return uploadedAt
    ? {
        id,
        shipmentId: shipment.id,
        kind,
        name,
        state: 'available',
        resourcePath: `/documents/${id}.html`,
        uploadedAt,
      }
    : { id, shipmentId: shipment.id, kind, name, state: 'missing' }
}

/** A slice of the dataset: shipments with their facts, documents and released events. */
export interface DataPart {
  shipments: Shipment[]
  events: OperatorEvent[]
  documents: ShipmentDocument[]
}

export function withDocuments(shipment: Shipment, documents: readonly ShipmentDocument[]) {
  return { ...shipment, documentIds: documents.map((item) => item.id) }
}
