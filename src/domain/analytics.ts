import type {
  AnalyticsFilters,
  EntityId,
  IsoDateTime,
  LegStage,
  LogisticsReport,
  ReportMetric,
  ReportMetricGroup,
  ShipmentLeg,
  ShipmentView,
} from './contracts'
import { buildTimeline, type ShipmentTimeline } from './projection'
import { reportFindings } from './findings'

export interface ReportInput {
  identityId: EntityId
  /** Views already scoped to the identity. The report never reads the full dataset. */
  shipments: readonly ShipmentView[]
  filters: AnalyticsFilters
  cutoffAt: IsoDateTime
  datasetRevision: number
}

/** Completed durations need this many observations before a value is shown. */
export const MIN_COMPLETED_SAMPLE = 3
/** An open wait is reported from a single observation: it describes a current situation. */
export const MIN_OPEN_SAMPLE = 1

const HOUR = 3_600_000

/** Last 90 days up to the cutoff, every origin site and operator. */
export function defaultAnalyticsFilters(cutoffAt: IsoDateTime): AnalyticsFilters {
  return {
    from: new Date(Date.parse(cutoffAt) - 90 * 86_400_000).toISOString(),
    to: cutoffAt,
    originSiteIds: [],
    operatorIds: [],
  }
}

/**
 * A shipment belongs to the period when it was created between `from` and `to`, both included.
 * Site filter: its origin site. Operator filter: any of its legs. Empty lists mean all visible.
 */
export function filterReportShipments(
  views: readonly ShipmentView[],
  filters: AnalyticsFilters,
): ShipmentView[] {
  const from = Date.parse(filters.from)
  const to = Date.parse(filters.to)
  return views.filter(({ shipment }) => {
    const created = Date.parse(shipment.createdAt)
    return (
      created >= from &&
      created <= to &&
      (!filters.originSiteIds.length || filters.originSiteIds.includes(shipment.originSiteId)) &&
      (!filters.operatorIds.length ||
        shipment.legs.some((leg) => filters.operatorIds.includes(leg.operatorId)))
    )
  })
}

interface Observation {
  shipmentId: EntityId
  hours: number
}

interface Collected {
  view: ShipmentView
  timeline: ShipmentTimeline
}

const round = (value: number) => Math.round(value * 10) / 10

function metric(
  base: Omit<ReportMetric, 'value' | 'sampleSize' | 'shipmentIds'>,
  observations: readonly Observation[],
): ReportMetric {
  const minimum = base.population === 'completed' ? MIN_COMPLETED_SAMPLE : MIN_OPEN_SAMPLE
  const value =
    observations.length >= minimum
      ? round(observations.reduce((sum, item) => sum + item.hours, 0) / observations.length)
      : null
  return {
    ...base,
    value,
    sampleSize: observations.length,
    shipmentIds: [...new Set(observations.map((item) => item.shipmentId))].sort(),
  }
}

const reachedAt = (timeline: ShipmentTimeline, leg: ShipmentLeg, stage: LegStage) => {
  const mark = timeline.reached.get(leg.id)?.get(stage)
  return mark ? Date.parse(mark.at) : null
}

/** Completed durations between two milestones, grouped. Waits still open are left out. */
function waits(
  items: readonly Collected[],
  select: (
    item: Collected,
  ) => { group: EntityId; start: number | null; end: number | null; applies: boolean }[],
) {
  const completed = new Map<EntityId, Observation[]>()
  for (const item of items)
    for (const { group, start, end, applies } of select(item)) {
      if (!applies || start === null || end === null || end < start) continue
      const list = completed.get(group) ?? []
      list.push({ shipmentId: item.view.shipment.id, hours: (end - start) / HOUR })
      completed.set(group, list)
    }
  return completed
}

const groupOrder: readonly ReportMetricGroup[] = ['delays', 'ports', 'customs', 'sites']

/**
 * Deterministic report from the filtered views: metrics, then findings and recommendations
 * written from templates over those metrics. Empty filter lists mean "all visible".
 */
export function buildLogisticsReport(input: ReportInput): LogisticsReport {
  const cutoff = Date.parse(input.cutoffAt)
  const views = filterReportShipments(input.shipments, input.filters)
  const items: Collected[] = views.map((view) => ({
    view,
    timeline: buildTimeline(view.shipment, view.events),
  }))
  const names = new Map<EntityId, string>()
  for (const { view } of items) {
    for (const location of view.locations) names.set(location.id, location.name)
    for (const operator of view.operators) names.set(operator.id, operator.name)
  }
  const nameOf = (id: EntityId) => names.get(id) ?? id
  const metrics: ReportMetric[] = []

  // Delays: delivered shipments against their commitment.
  const delivered = items.filter((item) => item.timeline.deliveredAt)
  const late = delivered
    .map(({ view, timeline }) => ({
      shipmentId: view.shipment.id,
      hours:
        (Date.parse(timeline.deliveredAt!.at) - Date.parse(view.shipment.committedDeliveryAt)) /
        HOUR,
    }))
    .filter((item) => item.hours > 0)
  const deliveredIds = delivered.map((item) => item.view.shipment.id).sort()
  const enough = delivered.length >= MIN_COMPLETED_SAMPLE
  metrics.push(
    {
      id: 'delayed-shipments',
      group: 'delays',
      label: 'Envíos entregados con retraso',
      definition: 'Envíos entregados después de la fecha comprometida.',
      unit: 'shipments',
      value: enough ? late.length : null,
      sampleSize: delivered.length,
      population: 'completed',
      shipmentIds: late.map((item) => item.shipmentId).sort(),
    },
    {
      id: 'on-time-rate',
      group: 'delays',
      label: 'Entregas a tiempo',
      definition: 'Porcentaje de envíos entregados no más tarde de la fecha comprometida.',
      unit: 'percent',
      value: enough ? round(((delivered.length - late.length) / delivered.length) * 100) : null,
      sampleSize: delivered.length,
      population: 'completed',
      shipmentIds: deliveredIds,
    },
    metric(
      {
        id: 'average-delay',
        group: 'delays',
        label: 'Retraso medio',
        definition: 'Horas entre la fecha comprometida y la entrega, en los envíos con retraso.',
        unit: 'hours',
        population: 'completed',
      },
      late,
    ),
  )
  const pending = items.filter((item) => !item.timeline.deliveredAt)
  const overdue = pending.filter(
    ({ view }) => cutoff > Date.parse(view.shipment.committedDeliveryAt),
  )
  metrics.push({
    id: 'overdue-open',
    group: 'delays',
    label: 'Envíos en curso fuera de plazo',
    definition: 'Envíos sin entregar cuya fecha comprometida ya ha pasado en la fecha de corte.',
    unit: 'shipments',
    value: pending.length >= MIN_OPEN_SAMPLE ? overdue.length : null,
    sampleSize: pending.length,
    population: 'open',
    shipmentIds: overdue.map((item) => item.view.shipment.id).sort(),
  })

  const pushGroups = (
    result: ReturnType<typeof waits>,
    group: ReportMetricGroup,
    prefix: string,
    label: (id: EntityId) => string,
    definition: string,
  ) => {
    for (const id of [...result.keys()].sort())
      metrics.push(
        metric(
          {
            id: `${prefix}:${id}`,
            group,
            label: label(id),
            definition,
            unit: 'hours',
            population: 'completed',
          },
          result.get(id)!,
        ),
      )
  }

  pushGroups(
    waits(items, ({ timeline }) =>
      timeline.legs
        .filter((leg) => leg.mode === 'sea')
        .map((leg) => ({
          group: leg.originLocationId,
          start: reachedAt(timeline, leg, 'at_origin_terminal'),
          end: reachedAt(timeline, leg, 'in_transit'),
          applies: true,
        })),
    ),
    'ports',
    'port-dwell',
    (id) => `Estancia en ${nameOf(id)}`,
    'Horas entre la entrada en la terminal de origen y la salida del buque.',
  )
  pushGroups(
    waits(items, ({ timeline }) =>
      timeline.legs
        .filter((leg) => leg.milestones.includes('customs'))
        .map((leg) => ({
          group: leg.originLocationId,
          start: reachedAt(timeline, leg, 'customs'),
          end: reachedAt(timeline, leg, 'collected'),
          applies: true,
        })),
    ),
    'customs',
    'customs-time',
    (id) => `Despacho aduanero en ${nameOf(id)}`,
    'Horas entre la presentación de la declaración y la liberación de la mercancía.',
  )
  pushGroups(
    waits(items, ({ view, timeline }) => {
      const first = timeline.legs[0]
      const created = Date.parse(view.shipment.createdAt)
      return first
        ? [
            {
              group: view.shipment.originSiteId,
              start: created,
              end: reachedAt(timeline, first, 'collected'),
              applies: created <= cutoff,
            },
          ]
        : []
    }),
    'sites',
    'site-pickup',
    (id) => `Recogida en ${nameOf(id)}`,
    'Horas entre la creación del envío y la recogida confirmada en el centro de origen.',
  )

  metrics.sort(
    (a, b) =>
      groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group) ||
      (a.population === b.population ? 0 : a.population === 'completed' ? -1 : 1),
  )

  const limitations: string[] = []
  if (!items.length) limitations.push('No hay envíos visibles con los filtros aplicados.')
  const withoutEvents = items.filter((item) => !item.view.events.length).length
  if (withoutEvents)
    limitations.push(
      `${withoutEvents} ${withoutEvents === 1 ? 'envío' : 'envíos'} sin eventos del operador; no aportan duraciones.`,
    )
  const withUnknown = items.filter((item) => item.timeline.unknownEventIds.length).length
  if (withUnknown)
    limitations.push(
      `${withUnknown} ${withUnknown === 1 ? 'envío' : 'envíos'} con códigos pendientes de clasificar; esos eventos no se usan.`,
    )
  const insufficient = metrics.filter((item) => item.value === null).length
  if (insufficient)
    limitations.push(
      `${insufficient} ${insufficient === 1 ? 'métrica' : 'métricas'} sin muestra suficiente (mínimo ${MIN_COMPLETED_SAMPLE} observaciones completadas).`,
    )

  return {
    id: `report-${input.identityId}-${input.datasetRevision}-${input.cutoffAt}`,
    identityId: input.identityId,
    generatedAt: input.cutoffAt,
    cutoffAt: input.cutoffAt,
    filters: input.filters,
    datasetRevision: input.datasetRevision,
    metrics,
    findings: reportFindings(metrics, views),
    limitations,
  }
}
