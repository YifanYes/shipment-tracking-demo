import { describe, expect, it } from 'vitest'
import type { LogisticsReport, ReportFinding, ReportMetric, ShipmentView } from '@/domain/contracts'
import {
  formatMetricValue,
  nodeWaits,
  isReportOutdated,
  madridDayStart,
  periodEnd,
} from '@/features/analytics/lib/report'

const metric = (
  id: string,
  group: ReportMetric['group'],
  population: ReportMetric['population'],
): ReportMetric => ({
  id,
  group,
  label: id,
  definition: '',
  unit: 'hours',
  value: 1,
  sampleSize: 1,
  population,
  shipmentIds: [],
})

describe('estructura del reporte', () => {
  it('detecta un reporte desactualizado por fecha de corte o revisión', () => {
    const report = { cutoffAt: '2026-10-31T10:00:00Z', datasetRevision: 3 } as LogisticsReport
    expect(isReportOutdated(report, { cutoffAt: '2026-10-31T10:00:00Z', datasetRevision: 3 })).toBe(
      false,
    )
    expect(isReportOutdated(report, { cutoffAt: '2026-10-31T12:00:00Z', datasetRevision: 3 })).toBe(
      true,
    )
    expect(isReportOutdated(report, { cutoffAt: '2026-10-31T10:00:00Z', datasetRevision: 4 })).toBe(
      true,
    )
  })

  it('ordena las esperas por nodo y marca la del hallazgo', () => {
    const view = {
      locations: [
        { id: 'port-valencia', name: 'Puerto de Valencia' },
        { id: 'port-algeciras', name: 'Puerto de Algeciras' },
      ],
      origin: null,
    } as unknown as ShipmentView
    const groups = nodeWaits(
      {
        metrics: [
          metric('delay.rate', 'delays', 'completed'),
          { ...metric('port-dwell:port-algeciras', 'ports', 'completed'), value: 10 },
          { ...metric('port-dwell:port-valencia', 'ports', 'completed'), value: 40 },
          { ...metric('port-dwell:port-unknown', 'ports', 'completed'), value: null },
        ],
        findings: [{ metricIds: ['port-dwell:port-valencia'] } as unknown as ReportFinding],
      },
      [view],
    )
    expect(groups.map((group) => group.key)).toEqual(['ports'])
    expect(groups[0]!.rows.map((row) => [row.name, row.share, row.flagged])).toEqual([
      ['Puerto de Valencia', 1, true],
      ['Puerto de Algeciras', 0.25, false],
      ['port-dwell:port-unknown', 0, false],
    ])
  })

  it('no inventa un valor cuando la muestra es insuficiente', () => {
    expect(formatMetricValue({ unit: 'hours', value: null })).toBe('Muestra insuficiente')
    expect(formatMetricValue({ unit: 'percent', value: 12.345 })).toBe('12,3 %')
  })

  it('convierte el periodo a días de Madrid sin superar el corte', () => {
    expect(madridDayStart('2026-08-02')).toBe('2026-08-01T22:00:00.000Z')
    expect(madridDayStart('2026-11-02')).toBe('2026-11-01T23:00:00.000Z')
    expect(periodEnd('2026-10-31', '2026-10-31T10:00:00Z')).toBe('2026-10-31T10:00:00Z')
    expect(periodEnd('2026-10-30', '2026-10-31T10:00:00Z')).toBe('2026-10-30T22:59:59.999Z')
  })
})
