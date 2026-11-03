import type { EntityId, ReportFinding, ReportMetric, ShipmentView } from './contracts'

/** A group stands out when its mean is this many times the rest and at least this many hours. */
export const BOTTLENECK_RATIO = 1.3
export const BOTTLENECK_MIN_HOURS = 4
/** The report stays readable: at most this many findings, the largest differences first. */
export const MAX_FINDINGS = 3

const number = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })
const h = (value: number) => `${number.format(Math.round(value * 10) / 10)} h`
const shipments = (count: number) => `${count} ${count === 1 ? 'envío' : 'envíos'}`

const evidenceOf = (ids: readonly EntityId[]) =>
  [...new Set(ids)].sort().map((id) => ({ kind: 'shipment' as const, id }))

const list = (items: readonly string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items.at(-1)}` : (items[0] ?? '')

interface Comparison {
  prefix: string
  noun: string
  recommendation: (name: string) => string
  /** Operators that handle the measured wait of a shipment for a group ID. */
  operators: (view: ShipmentView, groupId: EntityId) => EntityId[]
}

const comparisons: readonly Comparison[] = [
  {
    prefix: 'port-dwell',
    noun: 'puertos',
    recommendation: (name) =>
      `Ajustar con la terminal de ${name} la llegada de la carga al corte del buque.`,
    operators: (view, id) =>
      view.shipment.legs
        .filter((leg) => leg.mode === 'sea' && leg.originLocationId === id)
        .map((leg) => leg.operatorId),
  },
  {
    prefix: 'customs-time',
    noun: 'aduanas',
    recommendation: (name) =>
      `Validar la documentación antes de llegar a ${name} y revisar con el agente qué retiene las partidas.`,
    operators: (view, id) =>
      view.shipment.legs
        .filter((leg) => leg.milestones.includes('customs') && leg.originLocationId === id)
        .map((leg) => leg.operatorId),
  },
  {
    prefix: 'site-pickup',
    noun: 'centros',
    recommendation: (name) =>
      `Preparar la carga en ${name} antes de la franja de recogida y confirmarla el día anterior.`,
    operators: (view, id) =>
      view.shipment.originSiteId === id
        ? [...view.shipment.legs]
            .sort((a, b) => a.sequence - b.sequence)
            .slice(0, 1)
            .map((leg) => leg.operatorId)
        : [],
  },
]

const weightedMean = (metrics: readonly ReportMetric[]) => {
  const sample = metrics.reduce((sum, metric) => sum + metric.sampleSize, 0)
  return sample
    ? metrics.reduce((sum, metric) => sum + metric.value! * metric.sampleSize, 0) / sample
    : null
}

/**
 * Template findings from the report metrics. Every figure comes from a metric with its sample;
 * comparisons are presented as observed differences, never as causes, and an operator is only
 * named when the evidence does not also describe a port, a site or a route.
 */
export function reportFindings(
  metrics: readonly ReportMetric[],
  views: readonly ShipmentView[],
): ReportFinding[] {
  const viewsById = new Map(views.map((view) => [view.shipment.id, view]))
  const names = new Map<EntityId, string>()
  for (const view of views) {
    for (const location of view.locations) names.set(location.id, location.name)
    for (const operator of view.operators) names.set(operator.id, operator.name)
  }
  const nameOf = (id: EntityId) => names.get(id) ?? id
  const findings: (ReportFinding & { weight: number })[] = []

  for (const comparison of comparisons) {
    const group = metrics.filter(
      (metric) => metric.id.startsWith(`${comparison.prefix}:`) && metric.value !== null,
    )
    if (group.length < 2) continue
    const top = group.reduce((max, metric) => (metric.value! > max.value! ? metric : max))
    const rest = group.filter((metric) => metric !== top)
    const mean = weightedMean(rest)
    if (mean === null || mean <= 0) continue
    const ratio = top.value! / mean
    const difference = top.value! - mean
    if (ratio < BOTTLENECK_RATIO || difference < BOTTLENECK_MIN_HOURS) continue
    const topId = top.id.slice(comparison.prefix.length + 1)
    const restIds = rest.map((metric) => metric.id.slice(comparison.prefix.length + 1))
    const operatorsOf = (metric: ReportMetric, id: EntityId) =>
      new Set(
        metric.shipmentIds.flatMap((shipmentId) => {
          const view = viewsById.get(shipmentId)
          return view ? comparison.operators(view, id) : []
        }),
      )
    const topOperators = operatorsOf(top, topId)
    const restOperators = new Set(
      rest.flatMap((metric, index) => [...operatorsOf(metric, restIds[index]!)]),
    )
    const shared = [...topOperators]
      .filter((id) => restOperators.has(id))
      .map(nameOf)
      .sort()
    const name = nameOf(topId)
    const restSample = rest.reduce((sum, metric) => sum + metric.sampleSize, 0)
    findings.push({
      id: `finding-bottleneck-${comparison.prefix}`,
      title: `${top.label}: ${h(top.value!)} frente a ${h(mean)}`,
      explanation: `${number.format(Math.round(ratio * 10) / 10)} veces la media del resto de ${comparison.noun} (${list(restIds.map(nameOf))}).`,
      metricIds: [top.id, ...rest.map((metric) => metric.id)],
      evidence: evidenceOf(top.shipmentIds),
      recommendation: comparison.recommendation(name),
      priority: ratio >= 2 ? 'urgent' : 'normal',
      assumptions: [
        `Ahorro estimado: ${h(difference)} por envío, ${h(difference * top.sampleSize)} en el periodo, si ${name} igualara la media del resto con el mismo volumen.`,
      ],
      limitations: [
        `Muestra: ${shipments(top.sampleSize)} en ${name} y ${shipments(restSample)} en el resto.`,
        'Diferencia observada: no prueba su causa.',
        ...(shared.length
          ? [
              `${list(shared)} ${shared.length === 1 ? 'opera' : 'operan'} también en el resto de ${comparison.noun}: la diferencia no se atribuye al operador.`,
            ]
          : []),
      ],
      weight: ratio,
    })
  }

  return findings
    .sort(
      (a, b) =>
        Number(b.priority === 'urgent') - Number(a.priority === 'urgent') ||
        b.weight - a.weight ||
        a.id.localeCompare(b.id),
    )
    .slice(0, MAX_FINDINGS)
    .map(({ weight: _weight, ...finding }) => finding)
}
