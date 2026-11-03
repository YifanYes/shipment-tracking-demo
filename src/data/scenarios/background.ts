import type {
  DemoDataset,
  DemoScenario,
  DemoStep,
  EntityId,
  LegStage,
  OperatorEvent,
  ScheduledEvent,
  ShipmentLeg,
} from '@/domain/contracts'
import { operatorVocabularies } from '@/domain/events'
import { projectShipment } from '@/domain/projection'
import { at, scheduled } from './builders'

/** Code each operator uses to confirm a milestone. */
const stageCodes: Readonly<Record<EntityId, Partial<Record<LegStage, string>>>> = {
  'operator-iberia': {
    collected: 'PICKED_UP',
    in_transit: 'ON_ROUTE',
    out_for_delivery: 'OUT_FOR_DELIVERY',
    completed: 'DELIVERED',
  },
  'operator-cierzo': {
    collected: 'REC',
    in_transit: 'TRA',
    out_for_delivery: 'REP',
    completed: 'ENT',
  },
  'operator-boreal': {
    at_origin_terminal: 'GATE_IN',
    loaded: 'LOADED_ON_VESSEL',
    in_transit: 'VESSEL_DEPARTED',
    at_destination_terminal: 'VESSEL_ARRIVED',
    completed: 'DISCHARGED',
  },
  'operator-puente': {
    customs: 'ENTRY_LODGED',
    collected: 'CUSTOMS_RELEASED',
    in_transit: 'TRUCK_DEPARTED',
    out_for_delivery: 'OUT_FOR_DELIVERY',
    completed: 'POD',
  },
}

/** Position reports while moving; other stages repeat their own confirmation. */
const transitReportCodes: Readonly<Record<EntityId, string>> = {
  'operator-iberia': 'ON_ROUTE',
  'operator-cierzo': 'TRA',
  'operator-boreal': 'NOON_REPORT',
  'operator-puente': 'CHECKPOINT',
}

/** Maximum silence before a moving shipment sends a new report, below every stale threshold. */
const REPORT_GAP_MINUTES = 120
/** Deliveries without an operator ETA land this long before the commitment. */
const COMMITMENT_MARGIN_MINUTES = 45

const minutesOf = (time: string, referenceTime: string) =>
  Math.round((Date.parse(time) - Date.parse(referenceTime)) / 60_000)

interface Planned {
  leg: ShipmentLeg
  stage: LegStage
  minutes: number
}

function stageLocation(leg: ShipmentLeg, stage: LegStage) {
  if (['collected', 'at_origin_terminal', 'customs'].includes(stage)) return leg.originLocationId
  if (['at_destination_terminal', 'completed'].includes(stage)) return leg.destinationLocationId
  return undefined
}

function message(stage: LegStage, place: string, repeated: boolean) {
  if (repeated)
    return stage === 'in_transit'
      ? `Posición actualizada, en ruta hacia ${place}.`
      : `Sin cambios en ${place}.`
  const messages: Partial<Record<LegStage, string>> = {
    collected: `Mercancía recogida en ${place}.`,
    at_origin_terminal: `Contenedor recibido en ${place}.`,
    loaded: `Contenedor cargado en ${place}.`,
    in_transit: `En ruta hacia ${place}.`,
    at_destination_terminal: `Buque atracado en ${place}.`,
    customs: `Declaración presentada en ${place}.`,
    out_for_delivery: `En reparto en ${place}.`,
    completed: `Entrega confirmada en ${place}.`,
  }
  return messages[stage] ?? `Actualización en ${place}.`
}

/**
 * Keeps the rest of the operation moving while the story advances: every active shipment
 * outside the scenarios completes its milestones on time (or at its communicated ETA) and
 * reports often enough to stay current at each step. Deterministic, derived from the data.
 */
export function buildBackgroundScenario(
  dataset: DemoDataset,
  storyShipmentIds: readonly EntityId[],
  steps: readonly DemoStep[],
): DemoScenario {
  const { referenceTime } = dataset
  const stepMinutes = steps.map((step) => step.offsetMinutes).sort((a, b) => a - b)
  const lastStep = stepMinutes.at(-1) ?? 0
  const place = (id: EntityId) =>
    dataset.locations.find((location) => location.id === id)?.placeLabel ?? 'destino'
  const scheduledEvents: ScheduledEvent[] = []
  const background = dataset.shipments.filter(
    (shipment) =>
      !storyShipmentIds.includes(shipment.id) &&
      projectShipment(dataset, shipment, referenceTime).lifecycle !== 'delivered' &&
      Date.parse(shipment.createdAt) <= Date.parse(referenceTime),
  )

  for (const shipment of background) {
    const projection = projectShipment(dataset, shipment, referenceTime)
    const legs = [...shipment.legs].sort((a, b) => a.sequence - b.sequence)
    const remaining = legs.flatMap((leg) => {
      const confirmed = leg.milestones.indexOf(projection.legStages[leg.id] ?? 'planned')
      return leg.milestones
        .slice(confirmed + 1)
        .filter((stage) => stage !== 'planned' && stageCodes[leg.operatorId]?.[stage])
        .map((stage) => ({ leg, stage }))
    })
    if (!remaining.length) continue
    const lastEvent = dataset.events
      .filter((event) => event.shipmentId === shipment.id)
      .map((event) => minutesOf(event.occurredAt, referenceTime))
      .filter((minutes) => minutes <= 0)
      .sort((a, b) => b - a)[0]
    const start = Math.max(lastEvent ?? 0, 0)
    const eta =
      projection.eta.kind === 'operator' ? minutesOf(projection.eta.arrivalAt, referenceTime) : null
    const committed = minutesOf(shipment.committedDeliveryAt, referenceTime)
    // A late ETA is kept: the delivery confirms the delay instead of hiding it.
    const target = Math.max(
      eta !== null && eta > start ? eta : committed - COMMITMENT_MARGIN_MINUTES,
      start + 30 * remaining.length,
    )
    const plan: Planned[] = remaining.map((item, index) => ({
      ...item,
      minutes: Math.round(start + ((target - start) * (index + 1)) / remaining.length),
    }))

    const suffix = shipment.id.replace(/^shipment-/, '')
    const emit = (
      leg: ShipmentLeg,
      stage: LegStage,
      code: string,
      minutes: number,
      key: string,
      repeated: boolean,
    ) => {
      if (minutes + 2 > lastStep) return
      const locationId = stageLocation(leg, stage)
      const etaKey = operatorVocabularies[leg.operatorId]?.etaKey
      const event: OperatorEvent = {
        id: `event-${suffix}-${leg.sequence}-${key}`,
        shipmentId: shipment.id,
        legId: leg.id,
        operatorId: leg.operatorId,
        rawCode: code,
        rawMessage: message(
          stage,
          place(
            stage === 'in_transit' && repeated
              ? leg.destinationLocationId
              : (locationId ?? leg.destinationLocationId),
          ),
          repeated,
        ),
        payload: etaKey ? { [etaKey]: at(target) } : {},
        occurredAt: at(minutes),
        receivedAt: at(minutes + 2),
        ...(locationId && !repeated ? { locationId } : {}),
      }
      scheduledEvents.push(scheduled(minutes + 2, event))
    }

    for (const item of plan)
      emit(
        item.leg,
        item.stage,
        stageCodes[item.leg.operatorId]![item.stage]!,
        item.minutes,
        `bg-${item.stage}`,
        false,
      )

    // Reports between milestones so no step finds the shipment silent for too long.
    let last = {
      leg: legs.find((leg) => leg.id === projection.currentLegId) ?? legs[0]!,
      stage: projection.currentStage ?? 'planned',
      minutes: lastEvent ?? start,
    }
    let cursor = 0
    for (const step of stepMinutes) {
      while (cursor < plan.length && plan[cursor]!.minutes + 2 <= step) last = plan[cursor++]!
      const delivered = last.stage === 'completed' && last.leg.id === legs.at(-1)!.id
      if (delivered || step - last.minutes <= REPORT_GAP_MINUTES || last.stage === 'planned')
        continue
      const code =
        last.stage === 'in_transit'
          ? transitReportCodes[last.leg.operatorId]
          : stageCodes[last.leg.operatorId]?.[last.stage]
      if (!code) continue
      emit(last.leg, last.stage, code, step - 10, `report-${step}`, true)
    }
  }

  return {
    id: 'background-operations',
    name: 'Resto de la operación',
    shipmentIds: background.map((shipment) => shipment.id),
    scheduledEvents,
  }
}
