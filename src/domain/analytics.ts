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

function kilometres(a: readonly [number, number], b: readonly [number, number]) {
  const rad = Math.PI / 180
  const h =
    Math.sin(((b[1] - a[1]) * rad) / 2) ** 2 +
    Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(((b[0] - a[0]) * rad) / 2) ** 2
  return 12_742 * Math.asin(Math.sqrt(h))
}

/** Grouped durations between two milestones, separating completed and open waits. */
function waits(
  items: readonly Collected[],
  cutoff: number,
  select: (
    item: Collected,
  ) => { group: EntityId; start: number | null; end: number | null; applies: boolean }[],
) {
  const completed = new Map<EntityId, Observation[]>()
  const open = new Map<EntityId, Observation[]>()
  for (const item of items)
    for (const { group, start, end, applies } of select(item)) {
      if (!applies || start === null) continue
      const target = end === null ? open : completed
      const hours = ((end ?? cutoff) - start) / HOUR
      if (hours < 0) continue
      const list = target.get(group) ?? []
      list.push({ shipmentId: item.view.shipment.id, hours })
      target.set(group, list)
    }
  return { completed, open }
}

const groupOrder: readonly ReportMetricGroup[] = [
  'delays',
  'legs',
  'ports',
  'customs',
  'sites',
  'operators',
]

/**
 * Deterministic report from the filtered views. Phase 2 delivers metrics; phase 3 adds
 * findings and recommendations from templates. Empty filter lists mean "all visible".
 */
export function buildLogisticsReport(input: ReportInput): LogisticsReport {
  const cutoff = Date.parse(input.cutoffAt)
  const views = filterReportShipments(input.shipments, input.filters)
  const items: Collected[] = views.map((view) => ({
    view,
    timeline: buildTimeline(view.shipment, view.events),
  }))
  const names = new Map<EntityId, string>()
  const coordinates = new Map<EntityId, readonly [number, number]>()
  for (const { view } of items) {
    for (const location of view.locations) {
      names.set(location.id, location.name)
      if (location.coordinates) coordinates.set(location.id, location.coordinates)
    }
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

  // Leg duration by mode: first confirmed milestone to completion.
  const modeNames = { road: 'carretera', sea: 'mar' } as const
  const legs = waits(items, cutoff, ({ timeline }) =>
    timeline.legs.map((leg) => {
      const marks = [...(timeline.reached.get(leg.id)?.values() ?? [])]
      const first = marks.length ? Math.min(...marks.map((mark) => Date.parse(mark.at))) : null
      return {
        group: leg.mode,
        start: first,
        end: reachedAt(timeline, leg, 'completed'),
        applies: true,
      }
    }),
  )
  for (const mode of ['road', 'sea'] as const)
    if (legs.completed.has(mode))
      metrics.push(
        metric(
          {
            id: `leg-duration:${mode}`,
            group: 'legs',
            label: `Duración de tramos por ${modeNames[mode]}`,
            definition:
              'Horas entre el primer hito confirmado del tramo y su finalización, en tramos completados.',
            unit: 'hours',
            population: 'completed',
          },
          legs.completed.get(mode)!,
        ),
      )

  const pushGroups = (
    result: ReturnType<typeof waits>,
    group: ReportMetricGroup,
    prefix: string,
    label: (id: EntityId) => string,
    definition: string,
    openDefinition: string,
  ) => {
    for (const id of [...result.completed.keys()].sort())
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
          result.completed.get(id)!,
        ),
      )
    for (const id of [...result.open.keys()].sort())
      metrics.push(
        metric(
          {
            id: `${prefix}-open:${id}`,
            group,
            label: `${label(id)} · en curso`,
            definition: openDefinition,
            unit: 'hours',
            population: 'open',
          },
          result.open.get(id)!,
        ),
      )
  }

  pushGroups(
    waits(items, cutoff, ({ timeline }) =>
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
    'Horas desde la entrada en la terminal hasta la fecha de corte, sin salida del buque.',
  )
  pushGroups(
    waits(items, cutoff, ({ timeline }) =>
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
    'Horas desde la presentación de la declaración hasta la fecha de corte, sin liberación.',
  )
  pushGroups(
    waits(items, cutoff, ({ view, timeline }) => {
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
    'Horas desde la creación del envío hasta la fecha de corte, sin recogida confirmada.',
  )

  // Operator transit, normalized by straight-line distance so lanes of different length compare.
  const transit = new Map<EntityId, Observation[]>()
  for (const { view, timeline } of items)
    for (const leg of timeline.legs) {
      if (input.filters.operatorIds.length && !input.filters.operatorIds.includes(leg.operatorId))
        continue
      const a = coordinates.get(leg.originLocationId)
      const b = coordinates.get(leg.destinationLocationId)
      const km = a && b ? kilometres(a, b) : 0
      const start = reachedAt(timeline, leg, leg.mode === 'sea' ? 'in_transit' : 'collected')
      const end = reachedAt(
        timeline,
        leg,
        leg.mode === 'sea' ? 'at_destination_terminal' : 'completed',
      )
      if (km < 50 || start === null || end === null || end < start) continue
      const list = transit.get(leg.operatorId) ?? []
      list.push({ shipmentId: view.shipment.id, hours: ((end - start) / HOUR / km) * 100 })
      transit.set(leg.operatorId, list)
    }
  for (const id of [...transit.keys()].sort())
    metrics.push(
      metric(
        {
          id: `operator-transit:${id}`,
          group: 'operators',
          label: `Tránsito de ${nameOf(id)} por cada 100 km`,
          definition:
            'Horas de movimiento por cada 100 km en línea recta entre los extremos del tramo, en tramos completados de al menos 50 km. Excluye esperas en origen, puerto y aduana.',
          unit: 'hours',
          population: 'completed',
        },
        transit.get(id)!,
      ),
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
    limitations.push(`${withoutEvents} envíos sin eventos del operador; no aportan duraciones.`)
  const withUnknown = items.filter((item) => item.timeline.unknownEventIds.length).length
  if (withUnknown)
    limitations.push(
      `${withUnknown} envíos con códigos pendientes de clasificar; esos eventos no se usan.`,
    )
  const insufficient = metrics.filter((item) => item.value === null).length
  if (insufficient)
    limitations.push(
      `${insufficient} métricas sin muestra suficiente (mínimo ${MIN_COMPLETED_SAMPLE} observaciones completadas).`,
    )

  return {
    id: `report-${input.identityId}-${input.datasetRevision}-${input.cutoffAt}`,
    identityId: input.identityId,
    generatedAt: input.cutoffAt,
    cutoffAt: input.cutoffAt,
    filters: input.filters,
    datasetRevision: input.datasetRevision,
    metrics,
    findings: [],
    limitations,
  }
}
