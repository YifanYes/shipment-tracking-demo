import type {
  AnalyticsFilters,
  EvidenceReference,
  LogisticsReport,
  ReportMetric,
  ReportMetricGroup,
  ShipmentView,
} from '@/domain/contracts'

export interface ReportContext {
  cutoffAt: string
  datasetRevision: number
}

/** A report keeps its cutoff; any newer cutoff or dataset revision makes it outdated. */
export function isReportOutdated(report: LogisticsReport, context: ReportContext) {
  return report.cutoffAt !== context.cutoffAt || report.datasetRevision !== context.datasetRevision
}

type NodeGroup = Exclude<ReportMetricGroup, 'delays'>

export const nodeGroupLabels: Record<NodeGroup, string> = {
  ports: 'Estancia en puerto',
  customs: 'Despacho aduanero',
  sites: 'Recogida en centro de origen',
}

export interface NodeWait {
  metric: ReportMetric
  name: string
  /** Share of the longest wait in its group, 0 to 1, for the bar. */
  share: number
  /** The metric is the slow side of a finding. */
  flagged: boolean
}

/**
 * Waits per port, customs office and origin site, one block per group and slowest first.
 * Node names come from the visible views; open waits belong to the attention queue, not here.
 */
export function nodeWaits(
  report: Pick<LogisticsReport, 'metrics' | 'findings'>,
  views: readonly ShipmentView[],
): { key: NodeGroup; label: string; rows: NodeWait[] }[] {
  const names = new Map<string, string>()
  for (const view of views) {
    for (const location of view.locations) names.set(location.id, location.name)
    if (view.origin) names.set(view.origin.id, view.origin.name)
  }
  const flagged = new Set(report.findings.map((finding) => finding.metricIds[0]))
  return (Object.keys(nodeGroupLabels) as NodeGroup[])
    .map((key) => {
      const metrics = report.metrics.filter(
        (metric) => metric.group === key && metric.population === 'completed',
      )
      const longest = Math.max(0, ...metrics.map((metric) => metric.value ?? 0))
      const rows = metrics
        .map((metric) => {
          const id = metric.id.slice(metric.id.indexOf(':') + 1)
          return {
            metric,
            name: names.get(id) ?? metric.label,
            share: metric.value !== null && longest > 0 ? metric.value / longest : 0,
            flagged: flagged.has(metric.id),
          }
        })
        .sort(
          (a, b) =>
            (b.metric.value ?? -1) - (a.metric.value ?? -1) || a.name.localeCompare(b.name, 'es'),
        )
      return { key, label: nodeGroupLabels[key], rows }
    })
    .filter((group) => group.rows.length > 0)
}

const numberFormat = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })

export function formatMetricValue(metric: Pick<ReportMetric, 'unit' | 'value'>) {
  if (metric.value === null) return 'Muestra insuficiente'
  const value = numberFormat.format(metric.value)
  if (metric.unit === 'hours') return `${value} h`
  if (metric.unit === 'percent') return `${value} %`
  return `${value} ${metric.value === 1 ? 'envío' : 'envíos'}`
}

/** Calendar day in Europe/Madrid as YYYY-MM-DD. */
export function madridDate(iso: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

function madridOffsetMs(utcMs: number) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Madrid',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(utcMs))
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>
  const local = Date.UTC(
    parts.year!,
    parts.month! - 1,
    parts.day!,
    parts.hour!,
    parts.minute!,
    parts.second!,
  )
  return local - Math.floor(utcMs / 1000) * 1000
}

/** Start of a Madrid calendar day as an ISO instant. */
export function madridDayStart(date: string) {
  const guess = Date.parse(`${date}T00:00:00Z`)
  return new Date(guess - madridOffsetMs(guess)).toISOString()
}

/** Period end: the end of the Madrid day, never beyond the cutoff. */
export function periodEnd(date: string, cutoffAt: string) {
  const next = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
  const end = Date.parse(madridDayStart(next)) - 1
  return end >= Date.parse(cutoffAt) ? cutoffAt : new Date(end).toISOString()
}

export interface AnalyticsOption {
  value: string
  label: string
}

export function analyticsFilterOptions(views: readonly ShipmentView[]) {
  const origins = new Map<string, string>()
  const operators = new Map<string, string>()
  for (const view of views) {
    if (view.origin) origins.set(view.origin.id, view.origin.name)
    for (const operator of view.operators) operators.set(operator.id, operator.name)
  }
  const list = (map: Map<string, string>): AnalyticsOption[] =>
    [...map]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'))
  return { origins: list(origins), operators: list(operators) }
}

/** Names of the applied filter values; an empty list means every visible value. */
export function describeSelection(ids: readonly string[], options: readonly AnalyticsOption[]) {
  if (!ids.length) return 'Todos'
  return ids.map((id) => options.find((option) => option.value === id)?.label ?? id).join(', ')
}

/** Shipment that supports a piece of evidence, only if the identity can see it. */
export function evidenceShipmentId(reference: EvidenceReference, views: readonly ShipmentView[]) {
  const view = views.find((entry) =>
    reference.kind === 'shipment'
      ? entry.shipment.id === reference.id
      : reference.kind === 'operator_event'
        ? entry.events.some((event) => event.id === reference.id)
        : reference.kind === 'document'
          ? entry.documents.some((document) => document.id === reference.id)
          : false,
  )
  return view?.shipment.id ?? null
}

export function validatePeriod(filters: AnalyticsFilters) {
  return Date.parse(filters.from) <= Date.parse(filters.to)
    ? null
    : 'La fecha inicial es posterior a la final.'
}
