/** Shared contracts. Domain modules must not depend on React or UI components. */
export type EntityId = string
export type IsoDateTime = string
export type TransportMode = 'road' | 'sea'

export interface Account {
  id: EntityId
  name: string
}

export type DemoIdentity =
  | {
      id: EntityId
      name: string
      role: 'operations'
      allowedOriginSiteIds: readonly EntityId[]
      allowedAccountIds: readonly EntityId[]
    }
  | {
      id: EntityId
      name: string
      role: 'customer'
      accountId: EntityId
    }

export interface LogisticsLocation {
  id: EntityId
  name: string
  kind: 'factory' | 'warehouse' | 'port' | 'destination' | 'waypoint'
  placeLabel: string
  countryCode: string
  /** Coordinates of a site or a waypoint reported by an operator event. */
  coordinates?: readonly [longitude: number, latitude: number]
}

export interface Operator {
  id: EntityId
  name: string
  modes: readonly TransportMode[]
}

export type LegStage =
  | 'planned'
  | 'collected'
  | 'at_origin_terminal'
  | 'loaded'
  | 'in_transit'
  | 'at_destination_terminal'
  | 'customs'
  | 'out_for_delivery'
  | 'completed'

export interface ShipmentLeg {
  id: EntityId
  sequence: number
  mode: TransportMode
  operatorId: EntityId
  originLocationId: EntityId
  destinationLocationId: EntityId
  milestones: readonly LegStage[]
  /** Road-network geometry or a supplied maritime itinerary, never an endpoint shortcut. */
  route?: {
    coordinates: readonly (readonly [longitude: number, latitude: number])[]
    source: string
  }
}

export interface Shipment {
  id: EntityId
  reference: string
  accountId: EntityId
  originSiteId: EntityId
  destinationLocationId: EntityId
  createdAt: IsoDateTime
  committedDeliveryAt: IsoDateTime
  legs: readonly ShipmentLeg[]
  documentIds: readonly EntityId[]
}

export type JsonValue =
  string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue }

export interface OperatorEvent {
  id: EntityId
  shipmentId: EntityId
  legId: EntityId
  operatorId: EntityId
  rawCode: string
  rawMessage: string
  payload: { readonly [key: string]: JsonValue }
  occurredAt: IsoDateTime
  receivedAt: IsoDateTime
  locationId?: EntityId
}

export interface EvidenceReference {
  kind: 'operator_event' | 'document' | 'shipment' | 'activity'
  id: EntityId
}

export type IncidentKind = 'delay' | 'hold' | 'stale' | 'customs' | 'missing_document'

export type NormalizedSignal =
  | { kind: 'progress'; stage: LegStage }
  | { kind: 'incident_opened'; incidentKind: IncidentKind }
  | { kind: 'incident_cleared'; incidentKind: IncidentKind }
  | { kind: 'eta_updated'; arrivalAt: IsoDateTime }

/** An unknown code cannot silently become a confirmed milestone. */
export type NormalizedEvent =
  | {
      mapping: 'known'
      originalEventId: EntityId
      shipmentId: EntityId
      legId: EntityId
      occurredAt: IsoDateTime
      signals: readonly NormalizedSignal[]
    }
  | {
      mapping: 'unknown'
      originalEventId: EntityId
      shipmentId: EntityId
      legId: EntityId
      occurredAt: IsoDateTime
      reason: string
    }

export type ArrivalEstimate =
  | {
      kind: 'operator'
      arrivalAt: IsoDateTime
      issuedAt: IsoDateTime
      operatorId: EntityId
      evidence: readonly EvidenceReference[]
    }
  | {
      kind: 'estimate'
      earliestAt: IsoDateTime
      latestAt: IsoDateTime
      issuedAt: IsoDateTime
      assumptions: readonly string[]
      evidence: readonly EvidenceReference[]
    }
  | { kind: 'unavailable'; reason: string }

export interface ShipmentIncident {
  id: EntityId
  shipmentId: EntityId
  legId?: EntityId
  kind: IncidentKind
  severity: 'low' | 'medium' | 'high' | 'critical'
  condition: 'active' | 'cleared'
  attention: 'unreviewed' | 'in_progress' | 'handled'
  openedAt: IsoDateTime
  clearedAt?: IsoDateTime
  evidence: readonly EvidenceReference[]
}

export interface ShipmentDocument {
  id: EntityId
  shipmentId: EntityId
  kind: 'packing_list' | 'delivery_note' | 'customs' | 'bill_of_lading'
  name: string
  state: 'missing' | 'available'
  resourcePath?: string
  uploadedAt?: IsoDateTime
}

/** Derived data. Panels and map consume the same projection. */
export interface ShipmentProjection {
  shipmentId: EntityId
  lifecycle: 'planned' | 'active' | 'delivered'
  currentLegId: EntityId | null
  currentStage: LegStage | null
  eta: ArrivalEstimate
  freshness: 'current' | 'stale' | 'no_data'
  lastConfirmedLocation: {
    locationId: EntityId
    confirmedAt: IsoDateTime
    evidence: EvidenceReference
  } | null
  /** Highest confirmed milestone of every leg, keyed by leg ID. Never moves backwards. */
  legStages: Readonly<Record<EntityId, LegStage>>
  incidentIds: readonly EntityId[]
  unknownEventIds: readonly EntityId[]
}

/** Scoped read model shared by list, detail and map. No consumer reads the full dataset. */
export interface ShipmentView {
  shipment: Shipment
  projection: ShipmentProjection
  events: readonly OperatorEvent[]
  account: Account | undefined
  origin: LogisticsLocation | undefined
  destination: LogisticsLocation | undefined
  operators: readonly Operator[]
  documents: readonly ShipmentDocument[]
  locations: readonly LogisticsLocation[]
  /** Active and cleared incidents derived from the visible events and documents. */
  incidents: readonly ShipmentIncident[]
}

export interface ShipmentSummary {
  active: number
  delivered: number
  attention: number
  upcoming: number
}

export interface RecommendedAction {
  id: EntityId
  shipmentId: EntityId
  incidentId: EntityId
  kind: 'notify_customer' | 'contact_operator' | 'provide_document'
  title: string
  explanation: string
  priority: 'normal' | 'urgent'
  evidence: readonly EvidenceReference[]
}

export interface ActivityRecord {
  id: EntityId
  shipmentId: EntityId
  actorIdentityId: EntityId
  action: RecommendedAction['kind']
  recordedAt: IsoDateTime
  summary: string
  documentId?: EntityId
}

export interface ShipmentNotification {
  id: EntityId
  shipmentId: EntityId
  accountId: EntityId
  createdAt: IsoDateTime
  title: string
  message: string
  evidence: readonly EvidenceReference[]
}

export interface AnalyticsFilters {
  from: IsoDateTime
  to: IsoDateTime
  originSiteIds: readonly EntityId[]
  operatorIds: readonly EntityId[]
}

export type ReportMetricGroup = 'delays' | 'legs' | 'ports' | 'customs' | 'sites' | 'operators'

export interface ReportMetric {
  id: EntityId
  /** Section of the report the metric belongs to. */
  group: ReportMetricGroup
  label: string
  definition: string
  unit: 'hours' | 'percent' | 'shipments'
  value: number | null
  sampleSize: number
  population: 'completed' | 'open'
  shipmentIds: readonly EntityId[]
}

export interface ReportFinding {
  id: EntityId
  title: string
  explanation: string
  metricIds: readonly EntityId[]
  evidence: readonly EvidenceReference[]
  recommendation: string
  priority: 'normal' | 'urgent'
  assumptions: readonly string[]
  limitations: readonly string[]
}

export interface LogisticsReport {
  id: EntityId
  identityId: EntityId
  generatedAt: IsoDateTime
  cutoffAt: IsoDateTime
  filters: AnalyticsFilters
  datasetRevision: number
  metrics: readonly ReportMetric[]
  findings: readonly ReportFinding[]
  limitations: readonly string[]
}

export interface DemoDataset {
  revision: number
  referenceTime: IsoDateTime
  accounts: readonly Account[]
  identities: readonly DemoIdentity[]
  locations: readonly LogisticsLocation[]
  operators: readonly Operator[]
  shipments: readonly Shipment[]
  events: readonly OperatorEvent[]
  documents: readonly ShipmentDocument[]
}

export interface ScheduledEvent {
  offsetMinutes: number
  event: OperatorEvent
}

export interface DemoScenario {
  id: EntityId
  name: string
  shipmentIds: readonly EntityId[]
  scheduledEvents: readonly ScheduledEvent[]
}

/** Initial state of the demo: facts already received plus the events the clock will release. */
export interface DemoSeed {
  dataset: DemoDataset
  scenarios: readonly DemoScenario[]
}
