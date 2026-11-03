import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ChartNoAxesCombined, Check, LoaderCircle, RefreshCw } from 'lucide-react'
import type {
  AnalyticsFilters,
  LogisticsReport,
  ReportFinding,
  ReportMetric,
  ShipmentView,
} from '@/domain/contracts'
import {
  buildLogisticsReport,
  defaultAnalyticsFilters,
  filterReportShipments,
} from '@/domain/analytics'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { formatTime } from '@/shared/lib/format'
import {
  analyticsFilterOptions,
  describeSelection,
  evidenceShipmentId,
  formatMetricValue,
  isReportOutdated,
  madridDate,
  madridDayStart,
  nodeWaits,
  periodEnd,
  validatePeriod,
  type AnalyticsOption,
} from '../lib/report'

const dayFormat = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

/** Time the demo spends "querying" before showing the report. The report itself is local. */
export const REPORT_QUERY_MS = 1800

export function AnalyticsReport({
  shipments,
  identityId,
  cutoffAt,
  datasetRevision,
  onOpenShipment,
  queryMs = REPORT_QUERY_MS,
}: {
  shipments: readonly ShipmentView[]
  identityId: string
  cutoffAt: string
  datasetRevision: number
  onOpenShipment: (id: string) => void
  queryMs?: number
}) {
  const options = useMemo(() => analyticsFilterOptions(shipments), [shipments])
  const [fromDate, setFromDate] = useState(() => madridDate(defaultAnalyticsFilters(cutoffAt).from))
  const [toDate, setToDate] = useState(() => madridDate(cutoffAt))
  const [originSiteIds, setOriginSiteIds] = useState<string[]>([])
  const [operatorIds, setOperatorIds] = useState<string[]>([])
  const [generated, setGenerated] = useState<LogisticsReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<{ count: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  if (!shipments.length)
    return (
      <section className="empty-page">
        <div className="empty-icon">
          <ChartNoAxesCombined size={30} aria-hidden="true" />
        </div>
        <h2>No hay histórico de envíos</h2>
      </section>
    )

  const filters: AnalyticsFilters | null =
    fromDate && toDate
      ? {
          from: madridDayStart(fromDate),
          to: periodEnd(toDate, cutoffAt),
          originSiteIds: originSiteIds.filter((id) => options.origins.some((o) => o.value === id)),
          operatorIds: operatorIds.filter((id) => options.operators.some((o) => o.value === id)),
        }
      : null
  const periodError = filters ? validatePeriod(filters) : 'Indica el periodo completo.'
  // A report generated for another identity is never shown.
  const report = generated?.identityId === identityId ? generated : null
  const outdated = report ? isReportOutdated(report, { cutoffAt, datasetRevision }) : false

  const build = (input: AnalyticsFilters) => {
    try {
      setGenerated(
        buildLogisticsReport({ identityId, shipments, filters: input, cutoffAt, datasetRevision }),
      )
      setError(null)
    } catch (cause) {
      setGenerated(null)
      setError(cause instanceof Error ? cause.message : 'Error desconocido.')
    }
  }
  const generate = () => {
    if (!filters || periodError || loading) return
    if (queryMs <= 0) {
      build(filters)
      return
    }
    setLoading({ count: filterReportShipments(shipments, filters).length })
    timer.current = setTimeout(() => {
      timer.current = null
      setLoading(null)
      build(filters)
    }, queryMs)
  }
  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    generate()
  }
  const maxDate = madridDate(cutoffAt)

  return (
    <div className="analytics-report">
      <form className="analytics-filters" onSubmit={onSubmit} aria-label="Filtros del reporte">
        <fieldset className="analytics-filter">
          <legend>Periodo</legend>
          <div className="analytics-period">
            <input
              type="date"
              aria-label="Desde"
              value={fromDate}
              max={toDate || maxDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
            <span aria-hidden="true">–</span>
            <input
              type="date"
              aria-label="Hasta"
              value={toDate}
              min={fromDate}
              max={maxDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </div>
        </fieldset>
        <ChipGroup
          legend="Centro de origen"
          options={options.origins}
          selected={originSiteIds}
          onChange={setOriginSiteIds}
        />
        <ChipGroup
          legend="Operador"
          options={options.operators}
          selected={operatorIds}
          onChange={setOperatorIds}
        />
        <div className="analytics-submit">
          <Button type="submit" disabled={Boolean(periodError) || Boolean(loading)}>
            {loading ? (
              <LoaderCircle className="analytics-spin" aria-hidden="true" />
            ) : (
              <ChartNoAxesCombined aria-hidden="true" />
            )}
            Generar reporte
          </Button>
        </div>
        {periodError && (
          <p className="analytics-error" role="alert">
            {periodError}
          </p>
        )}
      </form>

      {loading ? (
        <ReportLoading count={loading.count} durationMs={queryMs} />
      ) : (
        <>
          {error && (
            <div className="analytics-error-panel" role="alert">
              <strong>No se pudo generar el reporte</strong>
              <p>{error}</p>
            </div>
          )}
          {report && (
            <ReportView
              report={report}
              outdated={outdated}
              shipments={shipments}
              origins={options.origins}
              operators={options.operators}
              onRegenerate={generate}
              canRegenerate={!periodError}
              onOpenShipment={onOpenShipment}
            />
          )}
        </>
      )}
    </div>
  )
}

/** Toggle chips: no chip pressed means every visible value. */
function ChipGroup({
  legend,
  options,
  selected,
  onChange,
}: {
  legend: string
  options: readonly AnalyticsOption[]
  selected: readonly string[]
  onChange: (value: string[]) => void
}) {
  // A single option filters nothing: the report already covers everything visible.
  if (options.length < 2) return null
  return (
    <fieldset className="analytics-filter">
      <legend>{legend}</legend>
      <div className="analytics-chips">
        <button
          type="button"
          className="analytics-chip"
          aria-pressed={selected.length === 0}
          onClick={() => onChange([])}
        >
          Todos
        </button>
        {options.map((option) => {
          const pressed = selected.includes(option.value)
          return (
            <button
              key={option.value}
              type="button"
              className="analytics-chip"
              aria-pressed={pressed}
              onClick={() =>
                onChange(
                  pressed
                    ? selected.filter((id) => id !== option.value)
                    : [...selected, option.value],
                )
              }
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

const loadingSteps = (count: number) => [
  `Consultando eventos de ${count} ${count === 1 ? 'envío' : 'envíos'}`,
  'Calculando esperas por nodo',
  'Comparando con el resto de la red',
]

function ReportLoading({ count, durationMs }: { count: number; durationMs: number }) {
  const steps = loadingSteps(count)
  const [current, setCurrent] = useState(0)
  useEffect(() => {
    const id = setInterval(
      () => setCurrent((step) => Math.min(step + 1, steps.length - 1)),
      durationMs / steps.length,
    )
    return () => clearInterval(id)
  }, [durationMs, steps.length])
  return (
    <section className="report report-loading" aria-busy="true" aria-labelledby="report-loading">
      <h2 id="report-loading" className="sr-only">
        Generando reporte
      </h2>
      <ol className="report-steps" aria-live="polite">
        {steps.map((step, index) => (
          <li
            key={step}
            data-state={index < current ? 'done' : index === current ? 'current' : 'pending'}
          >
            {index < current ? (
              <Check aria-hidden="true" />
            ) : index === current ? (
              <LoaderCircle className="analytics-spin" aria-hidden="true" />
            ) : (
              <span className="report-step-dot" aria-hidden="true" />
            )}
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <div className="report-skeleton" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </section>
  )
}

function ReportView({
  report,
  outdated,
  shipments,
  origins,
  operators,
  onRegenerate,
  canRegenerate,
  onOpenShipment,
}: {
  report: LogisticsReport
  outdated: boolean
  shipments: readonly ShipmentView[]
  origins: readonly AnalyticsOption[]
  operators: readonly AnalyticsOption[]
  onRegenerate: () => void
  canRegenerate: boolean
  onOpenShipment: (id: string) => void
}) {
  const references = new Map(shipments.map((view) => [view.shipment.id, view.shipment.reference]))
  const metrics = new Map(report.metrics.map((metric) => [metric.id, metric]))
  const nodes = nodeWaits(report, shipments)
  const links = { references, onOpenShipment }
  const delayed = metrics.get('delayed-shipments')
  const onTime = metrics.get('on-time-rate')
  return (
    <section className="report" aria-labelledby="report-title" data-outdated={outdated}>
      <div className="report-heading">
        <div>
          <h2 id="report-title">Reporte logístico</h2>
          <p className="report-meta">
            Corte {formatTime(report.cutoffAt)} · {dayFormat.format(new Date(report.filters.from))}{' '}
            – {dayFormat.format(new Date(report.filters.to))} · Centros:{' '}
            {describeSelection(report.filters.originSiteIds, origins)} · Operadores:{' '}
            {describeSelection(report.filters.operatorIds, operators)}
          </p>
        </div>
        {outdated && (
          <div className="report-outdated" aria-live="polite">
            <span>Desactualizado: hay datos posteriores al corte del reporte.</span>
            <Button variant="outline" size="sm" onClick={onRegenerate} disabled={!canRegenerate}>
              <RefreshCw aria-hidden="true" />
              Regenerar
            </Button>
          </div>
        )}
      </div>

      <ul className="report-kpis" aria-label="Indicadores">
        <Kpi
          metric={onTime}
          label="Entregas a tiempo"
          detail={
            delayed?.value != null && onTime
              ? `${delayed.value} de ${onTime.sampleSize} con retraso`
              : null
          }
          shipmentIds={delayed?.shipmentIds}
          {...links}
        />
        <Kpi
          metric={metrics.get('overdue-open')}
          label="En curso fuera de plazo"
          detail="Sin entregar tras la fecha comprometida"
          shipmentIds={metrics.get('overdue-open')?.shipmentIds}
          tone={(metrics.get('overdue-open')?.value ?? 0) > 0 ? 'alert' : undefined}
          {...links}
        />
        <Kpi
          metric={metrics.get('average-delay')}
          label="Retraso medio"
          detail="En las entregas con retraso"
          {...links}
        />
      </ul>

      {report.findings.length > 0 && (
        <section className="report-group" aria-labelledby="report-findings-title">
          <h3 id="report-findings-title">Hallazgos</h3>
          <ol className="report-findings">
            {report.findings.map((finding) => (
              <FindingRow key={finding.id} finding={finding} shipments={shipments} {...links} />
            ))}
          </ol>
        </section>
      )}

      {nodes.length > 0 ? (
        <section className="report-group" aria-labelledby="report-nodes-title">
          <h3 id="report-nodes-title">Esperas por nodo</h3>
          <table className="report-nodes">
            <thead>
              <tr>
                <th scope="col">Nodo</th>
                <th scope="col">Media</th>
                <th scope="col">
                  <span className="sr-only">Comparación</span>
                </th>
                <th scope="col">Envíos</th>
              </tr>
            </thead>
            {nodes.map((group) => (
              <tbody key={group.key}>
                <tr className="report-nodes-group">
                  <th scope="rowgroup" colSpan={4}>
                    {group.label}
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.metric.id} data-flagged={row.flagged}>
                    <th scope="row">{row.name}</th>
                    <td data-empty={row.metric.value === null}>{formatMetricValue(row.metric)}</td>
                    <td className="report-bar-cell" aria-hidden="true">
                      <span className="report-bar" style={{ width: `${row.share * 100}%` }} />
                    </td>
                    <td>{row.metric.sampleSize}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </section>
      ) : (
        !report.metrics.some((metric) => metric.value !== null) && (
          <p className="report-empty">Sin datos para estos filtros</p>
        )
      )}

      {report.limitations.length > 0 && (
        <details className="report-limitations">
          <summary>Limitaciones del reporte</summary>
          <ul className="report-list">
            {report.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

interface LinkProps {
  references: ReadonlyMap<string, string>
  onOpenShipment: (id: string) => void
}

function Kpi({
  metric,
  label,
  detail,
  shipmentIds,
  tone,
  ...links
}: LinkProps & {
  metric: ReportMetric | undefined
  label: string
  detail: string | null
  shipmentIds?: readonly string[]
  tone?: 'alert'
}) {
  if (!metric) return null
  return (
    <li className="report-kpi" data-tone={tone} data-empty={metric.value === null}>
      <span className="report-kpi-label">{label}</span>
      <strong>{formatMetricValue(metric)}</strong>
      {detail && <span className="report-kpi-detail">{detail}</span>}
      {shipmentIds && <ShipmentLinks ids={shipmentIds} label="Ver envíos" {...links} />}
    </li>
  )
}

function ShipmentLinks({
  ids,
  label,
  references,
  onOpenShipment,
}: LinkProps & { ids: readonly string[]; label: string }) {
  // Only shipments inside the identity's perimeter become links.
  const visible = [...new Set(ids)]
    .filter((id) => references.has(id))
    .sort((a, b) => references.get(a)!.localeCompare(references.get(b)!, 'es', { numeric: true }))
  if (!visible.length) return null
  return (
    <details className="report-shipments">
      <summary>
        {label} ({visible.length})
      </summary>
      <ul>
        {visible.map((id) => (
          <li key={id}>
            <Button variant="link" size="xs" onClick={() => onOpenShipment(id)}>
              {references.get(id)}
            </Button>
          </li>
        ))}
      </ul>
    </details>
  )
}

function FindingRow({
  finding,
  shipments,
  ...links
}: LinkProps & { finding: ReportFinding; shipments: readonly ShipmentView[] }) {
  const evidenceIds = finding.evidence
    .map((reference) => evidenceShipmentId(reference, shipments))
    .filter((id): id is string => id !== null)
  const notes = [...finding.assumptions, ...finding.limitations]
  return (
    <li className="report-finding" data-priority={finding.priority}>
      <div className="report-finding-heading">
        <h4>{finding.title}</h4>
        {finding.priority === 'urgent' && (
          <Badge variant="secondary" className="status-missing">
            Urgente
          </Badge>
        )}
      </div>
      <p>{finding.explanation}</p>
      <p className="report-recommendation">
        <strong>Recomendación:</strong> {finding.recommendation}
      </p>
      {(notes.length > 0 || evidenceIds.length > 0) && (
        <details className="report-finding-detail">
          <summary>Detalle</summary>
          {notes.length > 0 && (
            <ul className="report-list">
              {notes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          <ShipmentLinks ids={evidenceIds} label="Envíos que lo sustentan" {...links} />
        </details>
      )}
    </li>
  )
}
