import type {
  ActivityRecord,
  DemoDataset,
  EntityId,
  IsoDateTime,
  RecommendedAction,
  ShipmentIncident,
  ShipmentNotification,
  ShipmentView,
} from './contracts'
import { unresolvedUnknownEventIds } from './attention'
import { suggestClassification } from './classification'
import { assessDelayRisk } from './risk'

const HOUR = 3_600_000

const dateTime = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})
const when = (iso: IsoDateTime) => dateTime.format(new Date(iso))
const hoursBetween = (from: IsoDateTime, to: IsoDateTime) =>
  Math.round((Date.parse(to) - Date.parse(from)) / HOUR)

type IncidentView = Omit<ShipmentView, 'activity' | 'recommendations'>

const operatorOf = (view: IncidentView, incident: ShipmentIncident) => {
  const event = view.events.find((entry) =>
    incident.evidence.some((item) => item.kind === 'operator_event' && item.id === entry.id),
  )
  const legId = incident.legId ?? event?.legId ?? view.projection.currentLegId
  const operatorId =
    event?.operatorId ?? view.shipment.legs.find((leg) => leg.id === legId)?.operatorId
  return view.operators.find((operator) => operator.id === operatorId)
}

const placeOf = (view: IncidentView, incident: ShipmentIncident) => {
  const event = view.events.find(
    (entry) =>
      entry.locationId &&
      incident.evidence.some((item) => item.kind === 'operator_event' && item.id === entry.id),
  )
  const leg = view.shipment.legs.find((entry) => entry.id === incident.legId)
  const id = event?.locationId ?? leg?.originLocationId
  return view.locations.find((location) => location.id === id)?.placeLabel ?? 'destino'
}

const documentOf = (view: IncidentView, incident: ShipmentIncident) =>
  view.documents.find((document) =>
    incident.evidence.some((item) => item.kind === 'document' && item.id === document.id),
  )

/** A stale incident opens after the threshold; the last news is its evidence event. */
const lastNewsAt = (view: IncidentView, incident: ShipmentIncident) =>
  view.events.find((entry) =>
    incident.evidence.some((item) => item.kind === 'operator_event' && item.id === entry.id),
  )?.occurredAt ?? incident.openedAt

const customsActive = (view: IncidentView) =>
  view.incidents.some(
    (incident) =>
      incident.condition === 'active' && (incident.kind === 'customs' || incident.kind === 'hold'),
  )

/** What happened and what it implies, from the facts visible at the cutoff. */
export function explainIncident(
  view: IncidentView,
  incident: ShipmentIncident,
  cutoffAt: IsoDateTime,
): { summary: string; impact: string } {
  const { shipment, projection } = view
  const operator = operatorOf(view, incident)?.name ?? 'El operador'
  const committed = when(shipment.committedDeliveryAt)
  const eta = projection.eta
  switch (incident.kind) {
    case 'delay': {
      if (eta.kind === 'operator' && eta.arrivalAt > shipment.committedDeliveryAt)
        return {
          summary: `${operator} prevé la llegada el ${when(eta.arrivalAt)}. Compromiso: ${committed}.`,
          impact: `Retraso previsto de ${hoursBetween(shipment.committedDeliveryAt, eta.arrivalAt)} h.`,
        }
      if (Date.parse(cutoffAt) > Date.parse(shipment.committedDeliveryAt))
        return {
          summary: `El compromiso venció el ${committed} sin entrega confirmada.`,
          impact:
            eta.kind === 'unavailable'
              ? 'Sin ETA fiable: el retraso no se puede estimar.'
              : `Fuera de plazo desde hace ${hoursBetween(shipment.committedDeliveryAt, cutoffAt)} h.`,
        }
      return {
        summary: `${operator} avisa de un retraso. Compromiso: ${committed}.`,
        impact: 'El operador no ha confirmado una nueva fecha.',
      }
    }
    case 'customs':
    case 'hold': {
      const place = placeOf(view, incident)
      return {
        summary: `${incident.kind === 'customs' ? 'Retenido en la aduana' : 'Retenido en la terminal'} de ${place} desde el ${when(incident.openedAt)}.`,
        impact: `No continúa hasta que ${operator} confirme la liberación. Compromiso: ${committed}.`,
      }
    }
    case 'missing_document': {
      const document = documentOf(view, incident)
      const requested = incident.evidence.some((item) => item.kind === 'operator_event')
      return {
        summary: `Falta ${document?.name ?? 'un documento'}${requested ? `, solicitado por ${operator} el ${when(incident.openedAt)}` : ''}.`,
        impact: customsActive(view)
          ? 'Bloquea el despacho. Aportarlo no libera la mercancía.'
          : 'El expediente del envío está incompleto.',
      }
    }
    case 'stale': {
      const since = lastNewsAt(view, incident)
      return {
        summary: `Sin noticias de ${operator} desde el ${when(since)} (${hoursBetween(since, cutoffAt)} h).`,
        impact:
          eta.kind === 'unavailable'
            ? 'Sin ETA fiable.'
            : 'La ETA comunicada puede no estar vigente.',
      }
    }
  }
}

/** Every action that applies to the active incidents, whether recorded or not. */
export function candidateActions(view: IncidentView, cutoffAt: IsoDateTime): RecommendedAction[] {
  const { shipment, projection } = view
  const reference = shipment.reference
  const customer = view.account?.name ?? 'Cliente'
  const lane = `${view.origin?.placeLabel ?? 'origen'} → ${view.destination?.placeLabel ?? 'destino'}`
  const committed = when(shipment.committedDeliveryAt)
  const actions: RecommendedAction[] = []

  for (const incident of view.incidents) {
    if (incident.condition !== 'active') continue
    const urgent = incident.severity === 'high' || incident.severity === 'critical'
    const operator = operatorOf(view, incident)?.name ?? 'Operador'
    const base = {
      shipmentId: shipment.id,
      incidentId: incident.id,
      priority: urgent ? ('urgent' as const) : ('normal' as const),
      evidence: incident.evidence,
    }
    const add = (action: Omit<RecommendedAction, keyof typeof base | 'id'>) =>
      actions.push({ ...base, id: `action-${incident.id}-${action.kind}`, ...action })

    const notify = (subject: string, message: string, title: string, what: string) =>
      add({
        kind: 'notify_customer',
        title,
        explanation: `${customer} no tiene aviso ${what}.`,
        recipient: customer,
        subject,
        message,
      })
    const contact = (title: string, explanation: string, subject: string, message: string) =>
      add({ kind: 'contact_operator', title, explanation, recipient: operator, subject, message })

    switch (incident.kind) {
      case 'missing_document': {
        const document = documentOf(view, incident)
        if (!document) break
        add({
          kind: 'provide_document',
          title: `Aportar ${document.name}`,
          explanation: customsActive(view)
            ? 'Cierra la tarea documental. La retención sigue hasta que el operador confirme la liberación.'
            : 'Completa el expediente del envío.',
          recipient: operator,
          subject: document.name,
          message: `Se aporta ${document.name} para ${reference}.`,
          documentId: document.id,
        })
        break
      }
      case 'delay': {
        const eta = projection.eta
        const late = eta.kind === 'operator' && eta.arrivalAt > shipment.committedDeliveryAt
        notify(
          `${reference}: entrega con retraso`,
          late
            ? `Su envío ${reference} (${lane}) llegará previsiblemente el ${when(eta.arrivalAt)}, después de la fecha comprometida del ${committed}.`
            : `Su envío ${reference} (${lane}) no llegará en la fecha comprometida del ${committed}. Estamos confirmando la nueva fecha con el operador.`,
          'Avisar al cliente del retraso',
          'del retraso',
        )
        if (!late)
          contact(
            'Pedir nueva ETA al operador',
            'Sin una ETA del operador no se puede informar de la nueva fecha.',
            `${reference}: nueva fecha de entrega`,
            `Necesitamos una fecha de entrega actualizada para ${reference}. Estaba comprometida para el ${committed}.`,
          )
        break
      }
      case 'customs':
      case 'hold': {
        const place = placeOf(view, incident)
        const where = incident.kind === 'customs' ? 'la aduana' : 'la terminal'
        notify(
          `${reference}: retenido en ${where} de ${place}`,
          `Su envío ${reference} (${lane}) está retenido en ${where} de ${place}. Estamos gestionando su liberación.`,
          'Avisar al cliente de la retención',
          'de la retención',
        )
        contact(
          'Pedir fecha de liberación',
          'Solo el operador puede confirmar la liberación.',
          `${reference}: estado de la retención en ${place}`,
          `Solicitamos el estado de la retención de ${reference} en ${place}, la fecha prevista de liberación y la documentación pendiente, si la hay.`,
        )
        break
      }
      case 'stale':
        contact(
          'Pedir posición y ETA al operador',
          'Solo el operador puede confirmar la posición actual.',
          `${reference}: sin actualizaciones`,
          `No recibimos actualizaciones de ${reference} desde el ${when(lastNewsAt(view, incident))}. Necesitamos la última posición confirmada y una ETA.`,
        )
        break
    }
  }

  // Nothing received yet: the only possible step is asking the operator of the first leg.
  if (projection.freshness === 'no_data' && projection.lifecycle !== 'delivered') {
    const firstLeg = [...shipment.legs].sort((a, b) => a.sequence - b.sequence)[0]
    actions.push({
      id: `action-no-data-${shipment.id}-contact_operator`,
      shipmentId: shipment.id,
      incidentId: `no-data-${shipment.id}`,
      kind: 'contact_operator',
      title: 'Confirmar la recogida con el operador',
      explanation: 'No se ha recibido ningún evento de este envío.',
      priority: 'normal',
      evidence: [{ kind: 'shipment', id: shipment.id }],
      recipient:
        view.operators.find((operator) => operator.id === firstLeg?.operatorId)?.name ?? 'Operador',
      subject: `${reference}: sin eventos`,
      message: `No hemos recibido eventos de ${reference} (${lane}). ¿Podéis confirmar la fecha de recogida? Entrega comprometida: ${committed}.`,
    })
  }

  // The risk only asks for what no incident has asked already: a confirmation from the operator.
  const risk = assessDelayRisk(view, cutoffAt)
  if (risk && !actions.some((action) => action.kind === 'contact_operator')) {
    const operatorId = shipment.legs.find((leg) => leg.id === projection.currentLegId)?.operatorId
    actions.push({
      id: `action-${risk.id}-contact_operator`,
      shipmentId: shipment.id,
      incidentId: risk.id,
      kind: 'contact_operator',
      title: 'Confirmar la ETA con el operador',
      explanation: `Faltan datos confirmados para avisar a ${customer}.`,
      priority: risk.level === 'high' ? 'urgent' : 'normal',
      evidence: risk.evidence,
      recipient: view.operators.find((operator) => operator.id === operatorId)?.name ?? 'Operador',
      subject: `${reference}: confirmar llegada`,
      message: `${risk.factors.join(' ')} ¿Podéis confirmar si se mantiene la llegada antes del ${committed}?`,
    })
  }

  for (const eventId of unresolvedUnknownEventIds(view)) {
    const event = view.events.find((entry) => entry.id === eventId)
    const suggestion = event && suggestClassification(event)
    if (!event || !suggestion) continue
    const incidentId = `event-${event.id}`
    actions.push({
      id: `action-${incidentId}-classify_event`,
      shipmentId: shipment.id,
      incidentId,
      kind: 'classify_event',
      title: `Clasificar ${suggestion.code}`,
      explanation: `Confianza ${suggestion.confidence}. ${suggestion.rationale} No cambia el estado del envío.`,
      priority: 'normal',
      evidence: [{ kind: 'operator_event', id: event.id }],
      recipient:
        view.operators.find((operator) => operator.id === event.operatorId)?.name ?? 'Operador',
      subject: suggestion.interpretation,
      message: `${suggestion.code}: ${suggestion.interpretation}.`,
      eventId: event.id,
    })
  }
  return actions
}

/** Attention follows the recorded actions; the incident's condition follows only the facts. */
export function incidentAttention(
  incident: ShipmentIncident,
  candidates: readonly RecommendedAction[],
  activity: readonly ActivityRecord[],
): ShipmentIncident['attention'] {
  const recorded = new Set(
    activity.filter((record) => record.incidentId === incident.id).map((r) => r.actionId),
  )
  if (!recorded.size) return 'unreviewed'
  const own = candidates.filter((action) => action.incidentId === incident.id)
  return own.every((action) => recorded.has(action.id)) ? 'handled' : 'in_progress'
}

/** Activity, attention and pending recommendations of a view derived from incidents. */
export function withActions(view: IncidentView, dataset: DemoDataset, cutoffAt: IsoDateTime) {
  const activity = (dataset.activity ?? []).filter(
    (record) =>
      record.shipmentId === view.shipment.id &&
      Date.parse(record.recordedAt) <= Date.parse(cutoffAt),
  )
  const candidates = candidateActions(view, cutoffAt)
  const recorded = new Set(activity.map((record) => record.actionId))
  return {
    incidents: view.incidents.map((incident) => ({
      ...incident,
      attention: incidentAttention(incident, candidates, activity),
    })),
    activity,
    recommendations: candidates.filter((action) => !recorded.has(action.id)),
  }
}

/**
 * Record a pending recommendation of an authorized view. Returns the same dataset when the
 * action is not pending for that view, so a repeated click has no effect.
 */
export function recordAction(input: {
  dataset: DemoDataset
  view: ShipmentView
  actionId: EntityId
  actorIdentityId: EntityId
  at: IsoDateTime
  message?: string
}): DemoDataset {
  const action = input.view.recommendations.find((item) => item.id === input.actionId)
  if (!action) return input.dataset
  const message = input.message?.trim() || action.message
  const record: ActivityRecord = {
    id: `activity-${action.id}`,
    actionId: action.id,
    shipmentId: action.shipmentId,
    incidentId: action.incidentId,
    actorIdentityId: input.actorIdentityId,
    action: action.kind,
    recordedAt: input.at,
    recipient: action.recipient,
    subject: action.subject,
    message,
    ...(action.documentId ? { documentId: action.documentId } : {}),
    ...(action.eventId ? { eventId: action.eventId } : {}),
  }
  return applyActivity(input.dataset, [record])
}

/**
 * Apply recorded actions to a dataset, once per record ID. Providing a document marks it
 * available at the record time; nothing else changes facts. Also used to restore a session.
 */
export function applyActivity(dataset: DemoDataset, records: readonly ActivityRecord[]) {
  const existing = new Set((dataset.activity ?? []).map((record) => record.id))
  const added = records.filter((record) => !existing.has(record.id) && existing.add(record.id))
  if (!added.length) return dataset
  const provided = new Map(
    added
      .filter((record) => record.action === 'provide_document' && record.documentId)
      .map((record) => [record.documentId!, record.recordedAt]),
  )
  const documents = provided.size
    ? dataset.documents.map((document) =>
        provided.has(document.id) && document.state === 'missing'
          ? {
              ...document,
              state: 'available' as const,
              uploadedAt: provided.get(document.id)!,
              resourcePath: `/documents/${document.id}.html`,
            }
          : document,
      )
    : dataset.documents
  return {
    ...dataset,
    revision: provided.size ? dataset.revision + 1 : dataset.revision,
    documents,
    activity: [...(dataset.activity ?? []), ...added],
  }
}

/** Notices registered for the customer of each visible shipment, newest first. */
export function notificationsOf(views: readonly ShipmentView[]): ShipmentNotification[] {
  return views
    .flatMap((view) =>
      view.activity
        .filter((record) => record.action === 'notify_customer')
        .map((record): ShipmentNotification => ({
          id: `notification-${record.id}`,
          shipmentId: view.shipment.id,
          accountId: view.shipment.accountId,
          createdAt: record.recordedAt,
          title: record.subject,
          message: record.message,
          evidence: [{ kind: 'activity', id: record.id }],
        })),
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id))
}

/** Notices that still describe the present: their incident remains active at the cutoff. */
export function currentNotificationsOf(views: readonly ShipmentView[]): ShipmentNotification[] {
  return notificationsOf(
    views.map((view) => ({
      ...view,
      activity: view.activity.filter((record) =>
        view.incidents.some(
          (incident) => incident.id === record.incidentId && incident.condition === 'active',
        ),
      ),
    })),
  )
}
