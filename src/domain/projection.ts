import type {
  ArrivalEstimate,
  DemoDataset,
  EntityId,
  IncidentKind,
  IsoDateTime,
  LegStage,
  LogisticsLocation,
  NormalizedSignal,
  OperatorEvent,
  Shipment,
  ShipmentDocument,
  ShipmentIncident,
  ShipmentLeg,
  ShipmentProjection,
} from './contracts'
import { normalizeEvent, shipmentEvents } from './events'
import { incidentsFromTimeline } from './incidents'

const HOUR = 3_600_000

/** Hours without a known operator event before the information is considered stale. */
export const staleThresholdHours = {
  /** Collection, road transit and last mile. */
  road: 4,
  /** Gate-in, loading, arrival at terminal or waiting at a port between legs. */
  port: 24,
  /** Vessel sailing between ports; the carrier reports at least once a day. */
  sea: 36,
  /** Customs clearance at the destination port. */
  customs: 48,
} as const

export type StaleContext = keyof typeof staleThresholdHours

export interface StageMark {
  at: IsoDateTime
  eventId: EntityId
}

export interface TimelineEntry {
  event: OperatorEvent
  signals: readonly NormalizedSignal[]
}

/** Facts interpreted in occurrence order. Shared by projection, incidents and analytics. */
export interface ShipmentTimeline {
  legs: readonly ShipmentLeg[]
  entries: readonly TimelineEntry[]
  stages: ReadonlyMap<EntityId, LegStage>
  /** First time each milestone was confirmed, per leg. Skipped milestones are absent. */
  reached: ReadonlyMap<EntityId, ReadonlyMap<LegStage, StageMark>>
  lastInfo: StageMark | null
  lastLocation: (StageMark & { locationId: EntityId }) | null
  deliveredAt: StageMark | null
  unknownEventIds: readonly EntityId[]
}

export function buildTimeline(
  shipment: Shipment,
  events: readonly OperatorEvent[],
  locationExists: (id: EntityId) => boolean = () => true,
): ShipmentTimeline {
  const legs = [...shipment.legs].sort((a, b) => a.sequence - b.sequence)
  const stages = new Map(legs.map((leg) => [leg.id, 'planned' as LegStage]))
  const reached = new Map(legs.map((leg) => [leg.id, new Map<LegStage, StageMark>()]))
  const entries: TimelineEntry[] = []
  const unknownEventIds: string[] = []
  let lastInfo: StageMark | null = null
  let lastLocation: ShipmentTimeline['lastLocation'] = null
  let deliveredAt: StageMark | null = null

  for (const event of events) {
    const normalized = normalizeEvent(event)
    if (normalized.mapping === 'unknown') {
      unknownEventIds.push(event.id)
      continue
    }
    const leg = legs.find((item) => item.id === event.legId)
    if (!leg) continue
    entries.push({ event, signals: normalized.signals })
    const mark = { at: event.occurredAt, eventId: event.id }
    lastInfo = mark
    for (const signal of normalized.signals) {
      if (signal.kind !== 'progress') continue
      const previous = stages.get(leg.id) ?? 'planned'
      const index = leg.milestones.indexOf(signal.stage)
      if (index < 0 || index < leg.milestones.indexOf(previous)) continue
      stages.set(leg.id, signal.stage)
      const legReached = reached.get(leg.id)!
      if (!legReached.has(signal.stage)) legReached.set(signal.stage, mark)
      if (event.locationId && locationExists(event.locationId))
        lastLocation = { ...mark, locationId: event.locationId }
    }
    if (!deliveredAt && legs.length && legs.every((item) => stages.get(item.id) === 'completed'))
      deliveredAt = mark
  }
  return { legs, entries, stages, reached, lastInfo, lastLocation, deliveredAt, unknownEventIds }
}

export function currentLeg(timeline: ShipmentTimeline): ShipmentLeg | undefined {
  return (
    timeline.legs.find((leg) => timeline.stages.get(leg.id) !== 'completed') ?? timeline.legs.at(-1)
  )
}

/** Which threshold applies depends on where the shipment is waiting. */
export function staleContext(
  timeline: ShipmentTimeline,
  locationKind: (id: EntityId) => LogisticsLocation['kind'] | undefined,
): StaleContext {
  const leg = currentLeg(timeline)
  if (!leg) return 'road'
  const stage = timeline.stages.get(leg.id)
  if (stage === 'customs') return 'customs'
  if (leg.mode === 'sea') return stage === 'in_transit' ? 'sea' : 'port'
  if (stage === 'planned') {
    const previous = timeline.legs[timeline.legs.indexOf(leg) - 1]
    if (previous && locationKind(previous.destinationLocationId) === 'port') return 'port'
  }
  return 'road'
}

/** Incidents of these kinds keep the shipment held until their clearing event. */
const holdKinds: readonly IncidentKind[] = ['customs', 'hold']

function activeHoldOpenedAt(timeline: ShipmentTimeline): number | null {
  const open = new Map<IncidentKind, number>()
  for (const { event, signals } of timeline.entries)
    for (const signal of signals) {
      if (signal.kind === 'incident_opened' && holdKinds.includes(signal.incidentKind))
        if (!open.has(signal.incidentKind))
          open.set(signal.incidentKind, Date.parse(event.occurredAt))
      if (signal.kind === 'incident_cleared') open.delete(signal.incidentKind)
    }
  return open.size ? Math.min(...open.values()) : null
}

const SEA_KNOTS = [14, 18] as const
const ROAD_KMH = [60, 75] as const
const PORT_HOURS = [6, 24] as const

function kilometres(a: readonly [number, number], b: readonly [number, number]) {
  const rad = Math.PI / 180
  const dLat = (b[1] - a[1]) * rad
  const dLon = (b[0] - a[0]) * rad
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2
  return 12_742 * Math.asin(Math.sqrt(h))
}

function routeKilometres(coordinates: readonly (readonly [number, number])[], from = 0) {
  let total = 0
  for (let index = from + 1; index < coordinates.length; index++)
    total += kilometres(coordinates[index - 1]!, coordinates[index]!)
  return total
}

/** Interval estimate for a vessel at sea without an operator ETA. */
function estimateFromSea(
  timeline: ShipmentTimeline,
  leg: ShipmentLeg,
  coordinatesOf: (id: EntityId) => readonly [number, number] | undefined,
): ArrivalEstimate | null {
  const route = leg.route?.coordinates
  const departure = timeline.reached.get(leg.id)?.get('in_transit')
  if (!route || route.length < 2 || !departure) return null
  const position =
    timeline.lastLocation &&
    timeline.entries.find(({ event }) => event.id === timeline.lastLocation!.eventId)?.event
      .legId === leg.id
      ? timeline.lastLocation
      : null
  const point = position ? coordinatesOf(position.locationId) : undefined
  let from = 0
  if (point) {
    let best = Infinity
    route.forEach((vertex, index) => {
      const distance = kilometres(vertex, point)
      if (distance < best) [best, from] = [distance, index]
    })
  }
  const seaKm = routeKilometres(route, from)
  let roadKm = 0
  for (const next of timeline.legs.slice(timeline.legs.indexOf(leg) + 1)) {
    if (next.mode !== 'road' || !next.route || next.milestones.includes('customs')) return null
    roadKm += routeKilometres(next.route.coordinates)
  }
  const issued = position ?? departure
  const start = Date.parse(issued.at)
  const hours = (index: 0 | 1) =>
    seaKm / (SEA_KNOTS[1 - index]! * 1.852) + PORT_HOURS[index] + roadKm / ROAD_KMH[1 - index]!
  const round = (value: number) => new Date(Math.round(value / 60_000) * 60_000).toISOString()
  return {
    kind: 'estimate',
    earliestAt: round(start + hours(0) * HOUR),
    latestAt: round(start + hours(1) * HOUR),
    issuedAt: issued.at,
    assumptions: [
      `Velocidad del buque entre ${SEA_KNOTS[0]} y ${SEA_KNOTS[1]} nudos por el itinerario previsto.`,
      `Entre ${PORT_HOURS[0]} y ${PORT_HOURS[1]} horas de descarga y salida del puerto.`,
      `Carretera entre ${ROAD_KMH[0]} y ${ROAD_KMH[1]} km/h sin esperas adicionales.`,
    ],
    evidence: [{ kind: 'operator_event', id: issued.eventId }],
  }
}

function chooseEta(
  timeline: ShipmentTimeline,
  freshness: ShipmentProjection['freshness'],
  cutoffAt: IsoDateTime,
  coordinatesOf: (id: EntityId) => readonly [number, number] | undefined,
): ArrivalEstimate {
  let latest: { arrivalAt: IsoDateTime; event: OperatorEvent } | null = null
  for (const { event, signals } of timeline.entries)
    for (const signal of signals)
      if (signal.kind === 'eta_updated') latest = { arrivalAt: signal.arrivalAt, event }
  const delivered = !!timeline.deliveredAt
  if (latest) {
    const holdSince = activeHoldOpenedAt(timeline)
    if (!delivered && Date.parse(latest.arrivalAt) < Date.parse(cutoffAt))
      return {
        kind: 'unavailable',
        reason: 'La ETA del operador ha vencido sin confirmación de entrega.',
      }
    if (!delivered && holdSince !== null && holdSince > Date.parse(latest.event.occurredAt))
      return {
        kind: 'unavailable',
        reason: 'Retenido después de la última ETA; el operador no ha comunicado una nueva.',
      }
    return {
      kind: 'operator',
      arrivalAt: latest.arrivalAt,
      issuedAt: latest.event.occurredAt,
      operatorId: latest.event.operatorId,
      evidence: [{ kind: 'operator_event', id: latest.event.id }],
    }
  }
  if (!timeline.lastInfo)
    return { kind: 'unavailable', reason: 'No hay una ETA comunicada por el operador.' }
  if (!delivered && freshness === 'stale')
    return {
      kind: 'unavailable',
      reason: 'Información desactualizada y sin ETA comunicada por el operador.',
    }
  const leg = currentLeg(timeline)
  if (!delivered && leg) {
    const pending = timeline.legs.slice(timeline.legs.indexOf(leg))
    const customsPending = pending.some((item) => {
      const stage = timeline.stages.get(item.id) ?? 'planned'
      return (
        item.milestones.includes('customs') &&
        item.milestones.indexOf(stage) <= item.milestones.indexOf('customs')
      )
    })
    if (customsPending)
      return {
        kind: 'unavailable',
        reason: 'Pendiente de despacho aduanero y sin ETA comunicada por el operador.',
      }
    if (leg.mode === 'sea' && timeline.stages.get(leg.id) === 'in_transit') {
      const estimate = estimateFromSea(timeline, leg, coordinatesOf)
      if (estimate) return estimate
    }
  }
  return { kind: 'unavailable', reason: 'No hay una ETA comunicada por el operador.' }
}

export interface ShipmentTrack {
  timeline: ShipmentTimeline
  projection: ShipmentProjection
  incidents: readonly ShipmentIncident[]
}

const locationIndex = new WeakMap<
  readonly LogisticsLocation[],
  ReadonlyMap<EntityId, LogisticsLocation>
>()

export function locationsById(locations: readonly LogisticsLocation[]) {
  let index = locationIndex.get(locations)
  if (!index) {
    index = new Map(locations.map((location) => [location.id, location]))
    locationIndex.set(locations, index)
  }
  return index
}

const documentIndex = new WeakMap<
  readonly ShipmentDocument[],
  ReadonlyMap<EntityId, readonly ShipmentDocument[]>
>()

/** Documents of a shipment, indexed once per documents array. */
export function documentsOf(dataset: DemoDataset, shipment: Shipment): ShipmentDocument[] {
  let index = documentIndex.get(dataset.documents)
  if (!index) {
    const groups = new Map<EntityId, ShipmentDocument[]>()
    for (const document of dataset.documents) {
      const group = groups.get(document.shipmentId)
      if (group) group.push(document)
      else groups.set(document.shipmentId, [document])
    }
    index = groups
    documentIndex.set(dataset.documents, index)
  }
  return (index.get(shipment.id) ?? []).filter((document) =>
    shipment.documentIds.includes(document.id),
  )
}

const trackCache = new WeakMap<
  DemoDataset,
  { cutoffAt: IsoDateTime; tracks: WeakMap<Shipment, ShipmentTrack> }
>()

/** Projection and incidents of one shipment, memoized per dataset, cutoff and shipment. */
export function trackShipment(
  dataset: DemoDataset,
  shipment: Shipment,
  cutoffAt: IsoDateTime,
): ShipmentTrack {
  let cache = trackCache.get(dataset)
  if (!cache || cache.cutoffAt !== cutoffAt) {
    cache = { cutoffAt, tracks: new WeakMap() }
    trackCache.set(dataset, cache)
  }
  const cached = cache.tracks.get(shipment)
  if (cached) return cached

  const locations = locationsById(dataset.locations)
  const timeline = buildTimeline(shipment, shipmentEvents(dataset, shipment, cutoffAt), (id) =>
    locations.has(id),
  )
  const leg = currentLeg(timeline)
  const delivered = !!timeline.deliveredAt
  const context = staleContext(timeline, (id) => locations.get(id)?.kind)
  const freshness: ShipmentProjection['freshness'] = !timeline.lastInfo
    ? 'no_data'
    : !delivered &&
        Date.parse(cutoffAt) - Date.parse(timeline.lastInfo.at) >
          staleThresholdHours[context] * HOUR
      ? 'stale'
      : 'current'
  const eta = chooseEta(timeline, freshness, cutoffAt, (id) => locations.get(id)?.coordinates)
  const incidents = incidentsFromTimeline({
    shipment,
    timeline,
    documents: documentsOf(dataset, shipment),
    cutoffAt,
    stale:
      freshness === 'stale' && timeline.lastInfo
        ? {
            since: new Date(
              Date.parse(timeline.lastInfo.at) + staleThresholdHours[context] * HOUR,
            ).toISOString(),
            evidenceEventId: timeline.lastInfo.eventId,
            legId: leg?.id,
          }
        : null,
    etaAvailable: eta.kind !== 'unavailable',
  })
  const stages = timeline.stages
  const projection: ShipmentProjection = {
    shipmentId: shipment.id,
    lifecycle: delivered
      ? 'delivered'
      : [...stages.values()].some((stage) => stage !== 'planned')
        ? 'active'
        : 'planned',
    currentLegId: leg?.id ?? null,
    currentStage: leg ? stages.get(leg.id)! : null,
    legStages: Object.fromEntries(stages),
    eta,
    freshness,
    lastConfirmedLocation: timeline.lastLocation && {
      locationId: timeline.lastLocation.locationId,
      confirmedAt: timeline.lastLocation.at,
      evidence: { kind: 'operator_event', id: timeline.lastLocation.eventId },
    },
    incidentIds: incidents
      .filter((incident) => incident.condition === 'active')
      .map((incident) => incident.id),
    unknownEventIds: timeline.unknownEventIds,
  }
  const track = { timeline, projection, incidents }
  cache.tracks.set(shipment, track)
  return track
}

export function projectShipment(
  dataset: DemoDataset,
  shipment: Shipment,
  cutoffAt: IsoDateTime,
): ShipmentProjection {
  return trackShipment(dataset, shipment, cutoffAt).projection
}
