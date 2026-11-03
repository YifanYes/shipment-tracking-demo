import { describe, expect, it } from 'vitest'
import type { LogisticsReport, ReportMetric } from '@/domain/contracts'
import {
  formatMetricValue,
  groupMetrics,
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

  it('agrupa por dimensión sin mezclar hitos completados y esperas abiertas', () => {
    const groups = groupMetrics([
      metric('wait.customs.completed', 'customs', 'completed'),
      metric('wait.customs.open', 'customs', 'open'),
      metric('delay.rate', 'delays', 'completed'),
      metric('wait.port.valencia', 'ports', 'completed'),
    ])
    expect(groups.map((group) => group.key)).toEqual(['delays', 'ports', 'customs'])
    expect(groups[2]?.populations.map((entry) => entry.population)).toEqual(['completed', 'open'])
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
