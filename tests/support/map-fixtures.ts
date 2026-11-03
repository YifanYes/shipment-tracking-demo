import type {
  LogisticsLocation,
  Operator,
  OperatorEvent,
  ShipmentIncident,
  ShipmentLeg,
  ShipmentProjection,
  ShipmentView,
} from '@/domain/contracts'

/**
 * Hand-built read models for the map. They do not depend on the demo seed or on the projection
 * rules, so map tests keep their meaning while the dataset grows.
 */
export const mapCutoffAt = '2026-10-31T10:00:00.000Z'

type Point = readonly [number, number]

const location = (
  id: string,
  name: string,
  kind: LogisticsLocation['kind'],
  placeLabel: string,
  countryCode: string,
  coordinates?: Point,
): LogisticsLocation => ({ id, name, kind, placeLabel, countryCode, coordinates })

export const locations = {
  madrid: location('site-madrid', 'Centro Madrid', 'warehouse', 'Madrid', 'ES', [-3.7038, 40.4168]),
  zaragoza: location(
    'site-zaragoza',
    'Fábrica Zaragoza',
    'factory',
    'Zaragoza',
    'ES',
    [-0.8891, 41.6488],
  ),
  valenciaPort: location(
    'port-valencia',
    'Puerto de Valencia',
    'port',
    'Valencia',
    'ES',
    [-0.3167, 39.4425],
  ),
  algeciras: location(
    'port-algeciras',
    'Puerto de Algeciras',
    'port',
    'Algeciras',
    'ES',
    [-5.4352, 36.1283],
  ),
  tangerMed: location('port-tanger-med', 'Tanger Med', 'port', 'Tánger', 'MA', [-5.5, 35.885]),
  casablanca: location(
    'destination-casablanca',
    'Almacén Casablanca',
    'destination',
    'Casablanca',
    'MA',
    [-7.5898, 33.5731],
  ),
  valencia: location(
    'destination-valencia',
    'Almacén Valencia',
    'destination',
    'Valencia',
    'ES',
    [-0.3763, 39.4699],
  ),
  a3: location(
    'waypoint-a3-perales',
    'A-3 · Perales de Tajuña',
    'waypoint',
    'Perales de Tajuña',
    'ES',
    [-3.220108, 40.148136],
  ),
  alboran: location(
    'waypoint-alboran',
    'Mar de Alborán',
    'waypoint',
    'Alborán',
    'ES',
    [-3.2, 36.1],
  ),
  unmapped: location('waypoint-unmapped', 'Punto sin coordenadas', 'waypoint', 'Sin mapa', 'ES'),
} satisfies Record<string, LogisticsLocation>

const operators: Record<'road' | 'sea', Operator> = {
  road: { id: 'operator-road', name: 'Vía Cargo', modes: ['road'] },
  sea: { id: 'operator-sea', name: 'Mare Lines', modes: ['sea'] },
}

const routes = {
  madridValencia: [
    [-3.7038, 40.4168],
    [-3.220108, 40.148136],
    [-1.9, 39.7],
    [-0.3167, 39.4425],
  ],
  valenciaTanger: [
    [-0.3167, 39.4425],
    [0.2, 38.8],
    [-0.4, 37.7],
    [-2.0, 36.6],
    [-3.2, 36.1],
    [-5.5, 35.885],
  ],
  tangerCasablanca: [
    [-5.5, 35.885],
    [-5.9, 35.2],
    [-6.8, 34.0],
    [-7.5898, 33.5731],
  ],
  zaragozaAlgeciras: [
    [-0.8891, 41.6488],
    [-3.7, 40.4],
    [-4.8, 37.9],
    [-5.4352, 36.1283],
  ],
  algecirasTanger: [
    [-5.4352, 36.1283],
    [-5.42, 36.0],
    [-5.48, 35.92],
    [-5.5, 35.885],
  ],
} satisfies Record<string, Point[]>

function leg(
  id: string,
  sequence: number,
  mode: 'road' | 'sea',
  from: LogisticsLocation,
  to: LogisticsLocation,
  coordinates?: readonly Point[],
): ShipmentLeg {
  return {
    id,
    sequence,
    mode,
    operatorId: operators[mode].id,
    originLocationId: from.id,
    destinationLocationId: to.id,
    milestones: ['planned', 'loaded', 'in_transit', 'customs', 'completed'],
    route: coordinates && { coordinates, source: 'Fixture' },
  }
}

function view({
  id,
  reference,
  legs,
  projection,
  incidents = [],
  committedDeliveryAt = '2026-11-03T12:00:00.000Z',
}: {
  id: string
  reference: string
  legs: ShipmentLeg[]
  projection: Partial<ShipmentProjection>
  incidents?: ShipmentIncident[]
  committedDeliveryAt?: string
}): ShipmentView {
  const all = Object.values(locations)
  const origin = all.find((entry) => entry.id === legs[0]!.originLocationId)
  const destination = all.find((entry) => entry.id === legs.at(-1)!.destinationLocationId)
  const confirmed = projection.lastConfirmedLocation
  const events: OperatorEvent[] = confirmed
    ? [
        {
          id: confirmed.evidence.id,
          shipmentId: id,
          legId: projection.currentLegId ?? legs[0]!.id,
          operatorId: legs.find((entry) => entry.id === projection.currentLegId)?.operatorId ?? '',
          rawCode: 'POSITION',
          rawMessage: 'Posición confirmada.',
          payload: {},
          occurredAt: confirmed.confirmedAt,
          receivedAt: confirmed.confirmedAt,
          locationId: confirmed.locationId,
        },
      ]
    : []
  const ids = new Set([
    ...legs.flatMap((entry) => [entry.originLocationId, entry.destinationLocationId]),
    ...(confirmed ? [confirmed.locationId] : []),
  ])
  return {
    shipment: {
      id,
      reference,
      accountId: 'account-norte',
      originSiteId: origin!.id,
      destinationLocationId: destination!.id,
      createdAt: '2026-10-29T06:00:00.000Z',
      committedDeliveryAt,
      legs,
      documentIds: [],
    },
    projection: {
      shipmentId: id,
      lifecycle: 'active',
      currentLegId: legs[0]!.id,
      currentStage: 'in_transit',
      eta: { kind: 'unavailable', reason: 'Sin datos del operador marítimo' },
      freshness: 'current',
      lastConfirmedLocation: null,
      legStages: Object.fromEntries(legs.map((entry) => [entry.id, 'planned'])),
      incidentIds: incidents
        .filter((incident) => incident.condition === 'active')
        .map((incident) => incident.id),
      unknownEventIds: [],
      ...projection,
    },
    events,
    account: { id: 'account-norte', name: 'Norte Hogar' },
    origin,
    destination,
    operators: Object.values(operators).filter((operator) =>
      legs.some((entry) => entry.operatorId === operator.id),
    ),
    documents: [],
    locations: all.filter((entry) => ids.has(entry.id)),
    incidents,
  }
}

const confirmedAt = (locationId: string, minutesAgo: number, eventId: string) => ({
  locationId,
  confirmedAt: new Date(Date.parse(mapCutoffAt) - minutesAgo * 60_000).toISOString(),
  evidence: { kind: 'operator_event' as const, id: eventId },
})

const incident = (
  id: string,
  shipmentId: string,
  kind: ShipmentIncident['kind'],
  severity: ShipmentIncident['severity'],
  condition: ShipmentIncident['condition'] = 'active',
): ShipmentIncident => ({
  id,
  shipmentId,
  kind,
  severity,
  condition,
  attention: 'unreviewed',
  openedAt: '2026-10-30T08:00:00.000Z',
  evidence: [],
})

/** Madrid → Valencia by road (done), Valencia → Tánger by sea (at sea), Tánger → Casablanca. */
export const multimodal = view({
  id: 'shipment-multi',
  reference: 'ATL-MM-001',
  legs: [
    leg(
      'leg-multi-road-1',
      1,
      'road',
      locations.madrid,
      locations.valenciaPort,
      routes.madridValencia,
    ),
    leg(
      'leg-multi-sea',
      2,
      'sea',
      locations.valenciaPort,
      locations.tangerMed,
      routes.valenciaTanger,
    ),
    leg(
      'leg-multi-road-2',
      3,
      'road',
      locations.tangerMed,
      locations.casablanca,
      routes.tangerCasablanca,
    ),
  ],
  projection: {
    currentLegId: 'leg-multi-sea',
    currentStage: 'in_transit',
    legStages: {
      'leg-multi-road-1': 'completed',
      'leg-multi-sea': 'in_transit',
      'leg-multi-road-2': 'planned',
    },
    lastConfirmedLocation: confirmedAt(locations.alboran.id, 90, 'event-multi-position'),
    eta: {
      kind: 'estimate',
      earliestAt: '2026-11-01T08:00:00.000Z',
      latestAt: '2026-11-01T16:00:00.000Z',
      issuedAt: mapCutoffAt,
      assumptions: [],
      evidence: [],
    },
  },
  incidents: [
    incident('incident-multi-delay', 'shipment-multi', 'delay', 'high'),
    incident('incident-multi-stale', 'shipment-multi', 'stale', 'low', 'cleared'),
  ],
})

/** National road shipment on the A-3 with an operator ETA. */
export const road = view({
  id: 'shipment-road',
  reference: 'ATL-ES-101',
  legs: [leg('leg-road', 1, 'road', locations.madrid, locations.valencia, routes.madridValencia)],
  projection: {
    currentLegId: 'leg-road',
    lastConfirmedLocation: confirmedAt(locations.a3.id, 1, 'event-road-position'),
    eta: {
      kind: 'operator',
      arrivalAt: '2026-10-31T12:00:00.000Z',
      issuedAt: mapCutoffAt,
      operatorId: operators.road.id,
      evidence: [],
    },
  },
})

/** Confirmed at a point without coordinates and with no route geometry. */
export const withoutCoordinates = view({
  id: 'shipment-unmapped',
  reference: 'ATL-ES-102',
  legs: [leg('leg-unmapped', 1, 'road', locations.zaragoza, locations.valencia)],
  projection: {
    currentLegId: 'leg-unmapped',
    lastConfirmedLocation: confirmedAt(locations.unmapped.id, 30, 'event-unmapped-position'),
  },
})

/** Zaragoza → Algeciras → Tánger, held in customs after the crossing. */
export const customsHeld = view({
  id: 'shipment-customs',
  reference: 'ATL-MM-002',
  legs: [
    leg(
      'leg-customs-road',
      1,
      'road',
      locations.zaragoza,
      locations.algeciras,
      routes.zaragozaAlgeciras,
    ),
    leg(
      'leg-customs-sea',
      2,
      'sea',
      locations.algeciras,
      locations.tangerMed,
      routes.algecirasTanger,
    ),
  ],
  projection: {
    currentLegId: 'leg-customs-sea',
    currentStage: 'customs',
    legStages: { 'leg-customs-road': 'completed', 'leg-customs-sea': 'customs' },
    lastConfirmedLocation: confirmedAt(locations.tangerMed.id, 600, 'event-customs-position'),
  },
  incidents: [incident('incident-customs', 'shipment-customs', 'customs', 'critical')],
  committedDeliveryAt: '2026-11-05T12:00:00.000Z',
})

/** History: every leg completed; excluded from the map. */
export const delivered = view({
  id: 'shipment-delivered',
  reference: 'ATL-ES-090',
  legs: [
    leg('leg-delivered', 1, 'road', locations.zaragoza, locations.valencia, routes.madridValencia),
  ],
  projection: {
    lifecycle: 'delivered',
    currentLegId: 'leg-delivered',
    currentStage: 'completed',
    legStages: { 'leg-delivered': 'completed' },
    lastConfirmedLocation: confirmedAt(locations.valencia.id, 2_000, 'event-delivered'),
  },
  committedDeliveryAt: '2026-10-30T12:00:00.000Z',
})

export const mapShipments = [multimodal, road, withoutCoordinates, customsHeld, delivered]
