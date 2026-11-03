import { useMemo, useState, type FormEvent } from 'react'
import { ChartNoAxesCombined, RefreshCw } from 'lucide-react'
import type {
  AnalyticsFilters,
  LogisticsReport,
  ReportFinding,
  ReportMetric,
  ShipmentView,
} from '@/domain/contracts'
import { buildLogisticsReport, defaultAnalyticsFilters } from '@/domain/analytics'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { formatTime } from '@/shared/lib/format'
import {
  analyticsFilterOptions,
  describeSelection,
  evidenceShipmentId,
  formatMetricValue,
  groupMetrics,
  isReportOutdated,
  madridDate,
  madridDayStart,
  periodEnd,
  populationLabels,
  validatePeriod,
  type AnalyticsOption,
} from '../lib/report'

const dayFormat = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

export function AnalyticsReport({
  shipments,
  identityId,
  cutoffAt,
  datasetRevision,
  onOpenShipment,
}: {
  shipments: readonly ShipmentView[]
  identityId: string
  cutoffAt: string
  datasetRevision: number
  onOpenShipment: (id: string) => void
}) {
  const options = useMemo(() => analyticsFilterOptions(shipments), [shipments])
  const [fromDate, setFromDate] = useState(() => madridDate(defaultAnalyticsFilters(cutoffAt).from))
  const [toDate, setToDate] = useState(() => madridDate(cutoffAt))
  const [originSiteIds, setOriginSiteIds] = useState<string[]>([])
  const [operatorIds, setOperatorIds] = useState<string[]>([])
  const [generated, setGenerated] = useState<LogisticsReport | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  const generate = () => {
    if (!filters || periodError) return
    try {
      setGenerated(
        buildLogisticsReport({ identityId, shipments, filters, cutoffAt, datasetRevision }),
      )
      setError(null)
    } catch (cause) {
      setGenerated(null)
      setError(cause instanceof Error ? cause.message : 'Error desconocido.')
    }
  }
  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    generate()
  }
  const maxDate = madridDate(cutoffAt)

  return (
    <div className="analytics-report">
      <form className="analytics-filters" onSubmit={onSubmit} aria-label="Filtros del reporte">
        <fieldset className="analytics-period">
          <legend className="sr-only">Periodo</legend>
          <label>
            <span>Desde</span>
            <input
              type="date"
              value={fromDate}
              max={toDate || maxDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </label>
          <label>
            <span>Hasta</span>
            <input
              type="date"
              value={toDate}
              min={fromDate}
              max={maxDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </label>
        </fieldset>
        <CheckboxGroup
          legend="Centros de origen"
          options={options.origins}
          selected={originSiteIds}
          onChange={setOriginSiteIds}
        />
        <CheckboxGroup
          legend="Operadores"
          options={options.operators}
          selected={operatorIds}
          onChange={setOperatorIds}
        />
        <div className="analytics-submit">
          {periodError && (
            <p className="analytics-error" role="alert">
              {periodError}
            </p>
          )}
          <Button type="submit" disabled={Boolean(periodError)}>
            Generar reporte
          </Button>
        </div>
      </form>

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
    </div>
  )
}

function CheckboxGroup({
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
    <fieldset className="analytics-options">
      <legend>{legend}</legend>
      {options.map((option) => (
        <label key={option.value}>
          <input
            type="checkbox"
            checked={selected.includes(option.value)}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...selected, option.value]
                  : selected.filter((id) => id !== option.value),
              )
            }
          />
          {option.label}
        </label>
      ))}
    </fieldset>
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
  const groups = groupMetrics(report.metrics)
  return (
    <section className="report" aria-labelledby="report-title" data-outdated={outdated}>
      <div className="report-heading">
        <h2 id="report-title">Reporte logístico</h2>
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
      <dl className="report-meta">
        <div>
          <dt>Corte</dt>
          <dd>{formatTime(report.cutoffAt)}</dd>
        </div>
        <div>
          <dt>Periodo</dt>
          <dd>
            {dayFormat.format(new Date(report.filters.from))} –{' '}
            {dayFormat.format(new Date(report.filters.to))}
          </dd>
        </div>
        <div>
          <dt>Centros de origen</dt>
          <dd>{describeSelection(report.filters.originSiteIds, origins)}</dd>
        </div>
        <div>
          <dt>Operadores</dt>
          <dd>{describeSelection(report.filters.operatorIds, operators)}</dd>
        </div>
      </dl>

      {groups.length ? (
        groups.map((group) => (
          <section
            key={group.key}
            className="report-group"
            aria-labelledby={`report-group-${group.key}`}
          >
            <h3 id={`report-group-${group.key}`}>{group.label}</h3>
            {group.populations.map(({ population, metrics }) => (
              <div key={population} className="report-population" data-population={population}>
                <h4>{populationLabels[population]}</h4>
                <ul className="report-metrics">
                  {metrics.map((metric) => (
                    <MetricCard
                      key={metric.id}
                      metric={metric}
                      references={references}
                      onOpenShipment={onOpenShipment}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ))
      ) : (
        <p className="report-empty">Sin métricas para estos filtros</p>
      )}

      {report.findings.length > 0 && (
        <section className="report-group" aria-labelledby="report-findings-title">
          <h3 id="report-findings-title">Hallazgos</h3>
          <ul className="report-findings">
            {report.findings.map((finding) => (
              <FindingCard
                key={finding.id}
                finding={finding}
                shipments={shipments}
                references={references}
                onOpenShipment={onOpenShipment}
              />
            ))}
          </ul>
        </section>
      )}

      {report.limitations.length > 0 && (
        <section className="report-group" aria-labelledby="report-limitations-title">
          <h3 id="report-limitations-title">Limitaciones</h3>
          <ul className="report-list">
            {report.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </section>
      )}
    </section>
  )
}

function ShipmentLinks({
  ids,
  references,
  label,
  onOpenShipment,
}: {
  ids: readonly string[]
  references: ReadonlyMap<string, string>
  label: string
  onOpenShipment: (id: string) => void
}) {
  // Only shipments inside the identity's perimeter become links.
  const visible = [...new Set(ids)].filter((id) => references.has(id))
  if (!visible.length) return null
  return (
    <details className="report-shipments">
      <summary>{label}</summary>
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

function MetricCard({
  metric,
  references,
  onOpenShipment,
}: {
  metric: ReportMetric
  references: ReadonlyMap<string, string>
  onOpenShipment: (id: string) => void
}) {
  return (
    <li className="report-metric" data-empty={metric.value === null}>
      <h5>{metric.label}</h5>
      <strong className="report-metric-value">{formatMetricValue(metric)}</strong>
      <p>{metric.definition}</p>
      <p className="report-metric-sample">
        Muestra: {metric.sampleSize} {metric.sampleSize === 1 ? 'envío' : 'envíos'}
      </p>
      <ShipmentLinks
        ids={metric.shipmentIds}
        references={references}
        label="Envíos de la muestra"
        onOpenShipment={onOpenShipment}
      />
    </li>
  )
}

function FindingCard({
  finding,
  shipments,
  references,
  onOpenShipment,
}: {
  finding: ReportFinding
  shipments: readonly ShipmentView[]
  references: ReadonlyMap<string, string>
  onOpenShipment: (id: string) => void
}) {
  const evidenceIds = finding.evidence
    .map((reference) => evidenceShipmentId(reference, shipments))
    .filter((id): id is string => id !== null)
  return (
    <li className="report-finding" data-priority={finding.priority}>
      <div className="report-finding-heading">
        <h4>{finding.title}</h4>
        <Badge
          variant="secondary"
          className={finding.priority === 'urgent' ? 'status-missing' : 'status-transit'}
        >
          {finding.priority === 'urgent' ? 'Urgente' : 'Normal'}
        </Badge>
      </div>
      <p>{finding.explanation}</p>
      <p className="report-recommendation">
        <strong>Recomendación:</strong> {finding.recommendation}
      </p>
      {finding.assumptions.length > 0 && (
        <div>
          <h5>Supuestos</h5>
          <ul className="report-list">
            {finding.assumptions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {finding.limitations.length > 0 && (
        <div>
          <h5>Limitaciones</h5>
          <ul className="report-list">
            {finding.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      <ShipmentLinks
        ids={evidenceIds}
        references={references}
        label="Envíos que lo sustentan"
        onOpenShipment={onOpenShipment}
      />
    </li>
  )
}
