import type {
  DemoDataset,
  EntityId,
  IncidentKind,
  IsoDateTime,
  NormalizedEvent,
  NormalizedSignal,
  OperatorEvent,
  Shipment,
} from './contracts'

type Interpretation = readonly NormalizedSignal[]

const progress = (stage: Extract<NormalizedSignal, { kind: 'progress' }>['stage']) =>
  ({ kind: 'progress', stage }) as const
const opened = (incidentKind: IncidentKind) => ({ kind: 'incident_opened', incidentKind }) as const
const cleared = (incidentKind: IncidentKind) =>
  ({ kind: 'incident_cleared', incidentKind }) as const

interface Vocabulary {
  /** Payload key that carries the operator ETA at the shipment's final destination. */
  etaKey: string
  codes: Readonly<Record<string, Interpretation>>
}

/**
 * Each operator reports with its own codes. Different codes map to the same interpretation;
 * a code outside its operator's vocabulary stays pending classification.
 */
export const operatorVocabularies: Readonly<Record<EntityId, Vocabulary>> = {
  'operator-iberia': {
    etaKey: 'arrivalAt',
    codes: {
      PICKED_UP: [progress('collected')],
      ON_ROUTE: [progress('in_transit')],
      OUT_FOR_DELIVERY: [progress('out_for_delivery')],
      DELIVERED: [progress('completed')],
      ETA_UPDATE: [],
      DELAYED: [opened('delay')],
    },
  },
  'operator-cierzo': {
    etaKey: 'llegadaPrevista',
    codes: {
      REC: [progress('collected')],
      TRA: [progress('in_transit')],
      REP: [progress('out_for_delivery')],
      ENT: [progress('completed')],
      ETA: [],
      RET: [opened('delay')],
    },
  },
  'operator-boreal': {
    etaKey: 'eta',
    codes: {
      GATE_IN: [progress('at_origin_terminal')],
      LOADED_ON_VESSEL: [progress('loaded')],
      VESSEL_DEPARTED: [progress('in_transit')],
      NOON_REPORT: [progress('in_transit')],
      VESSEL_ARRIVED: [progress('at_destination_terminal')],
      DISCHARGED: [progress('completed')],
      ETA_REVISED: [],
      DELAY_NOTICE: [opened('delay')],
      TERMINAL_HOLD: [opened('hold')],
      HOLD_RELEASED: [cleared('hold')],
    },
  },
  'operator-puente': {
    etaKey: 'deliveryEta',
    codes: {
      ENTRY_LODGED: [progress('customs')],
      CUSTOMS_HOLD: [progress('customs'), opened('customs')],
      DOC_REQUIRED: [opened('missing_document')],
      // The release is the only event that moves the shipment out of customs.
      CUSTOMS_RELEASED: [cleared('customs'), progress('collected')],
      TRUCK_DEPARTED: [progress('in_transit')],
      CHECKPOINT: [progress('in_transit')],
      OUT_FOR_DELIVERY: [progress('out_for_delivery')],
      POD: [progress('completed')],
      NEW_ETA: [],
    },
  },
}

/** Operator vocabularies are explicit. Unknown codes never imply progress. */
export function normalizeEvent(event: OperatorEvent): NormalizedEvent {
  const base = {
    originalEventId: event.id,
    shipmentId: event.shipmentId,
    legId: event.legId,
    occurredAt: event.occurredAt,
  }
  const vocabulary = Object.hasOwn(operatorVocabularies, event.operatorId)
    ? operatorVocabularies[event.operatorId]
    : undefined
  const interpretation =
    vocabulary && Object.hasOwn(vocabulary.codes, event.rawCode)
      ? vocabulary.codes[event.rawCode]
      : undefined
  if (!vocabulary || !interpretation)
    return {
      ...base,
      mapping: 'unknown',
      reason: 'Código del operador pendiente de clasificación.',
    }
  const signals: NormalizedSignal[] = [...interpretation]
  const arrivalAt = event.payload[vocabulary.etaKey]
  if (typeof arrivalAt === 'string' && Number.isFinite(Date.parse(arrivalAt))) {
    signals.push({ kind: 'eta_updated', arrivalAt })
  }
  if (!signals.length)
    return {
      ...base,
      mapping: 'unknown',
      reason: 'El evento no contiene una ETA válida.',
    }
  return { ...base, mapping: 'known', signals }
}

const eventsByShipment = new WeakMap<
  readonly OperatorEvent[],
  ReadonlyMap<EntityId, readonly OperatorEvent[]>
>()

/** Events grouped by shipment, built once per events array. */
function indexEvents(events: readonly OperatorEvent[]) {
  let index = eventsByShipment.get(events)
  if (!index) {
    const groups = new Map<EntityId, OperatorEvent[]>()
    for (const event of events) {
      const group = groups.get(event.shipmentId)
      if (group) group.push(event)
      else groups.set(event.shipmentId, [event])
    }
    index = groups
    eventsByShipment.set(events, index)
  }
  return index
}

/** Only facts that happened AND were received by the cutoff can be shown. */
export function shipmentEvents(
  dataset: DemoDataset,
  shipment: Shipment,
  cutoffAt: IsoDateTime,
): OperatorEvent[] {
  const cutoff = Date.parse(cutoffAt)
  const seen = new Set<string>()
  return (indexEvents(dataset.events).get(shipment.id) ?? [])
    .filter((event) => {
      const leg = shipment.legs.find((item) => item.id === event.legId)
      const occurred = Date.parse(event.occurredAt)
      const received = Date.parse(event.receivedAt)
      if (
        !leg ||
        leg.operatorId !== event.operatorId ||
        !(occurred <= cutoff) ||
        !(received <= cutoff) ||
        seen.has(event.id)
      )
        return false
      seen.add(event.id)
      return true
    })
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || a.id.localeCompare(b.id))
}
