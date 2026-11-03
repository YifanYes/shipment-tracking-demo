import { describe, expect, it } from 'vitest'
import { buildLogisticsReport, MIN_COMPLETED_SAMPLE } from '@/domain/analytics'
import type { AnalyticsFilters, ReportMetric } from '@/domain/contracts'
import {
  fixtureShipments as fx,
  iso,
  reportCutoff,
  reportViews,
} from '@tests/support/domain-fixtures'

const all: AnalyticsFilters = { from: iso(-1), to: iso(100), originSiteIds: [], operatorIds: [] }
const report = (filters: Partial<AnalyticsFilters> = {}) =>
  buildLogisticsReport({
    identityId: 'operations-network',
    shipments: reportViews,
    filters: { ...all, ...filters },
    cutoffAt: reportCutoff,
    datasetRevision: 7,
  })
const byId = (metrics: readonly ReportMetric[]) =>
  Object.fromEntries(metrics.map((metric) => [metric.id, metric]))

describe('reporte logístico sobre un fixture conocido', () => {
  it('calcula demoras, esperas y muestras', () => {
    const result = report()
    const metrics = byId(result.metrics)
    expect(metrics['on-time-rate']).toMatchObject({
      value: 50,
      sampleSize: 4,
      population: 'completed',
    })
    expect(metrics['delayed-shipments']).toMatchObject({
      value: 2,
      sampleSize: 4,
      shipmentIds: [fx.b.id, fx.c.id],
    })
    // Two delayed shipments are below the minimum sample for an average.
    expect(metrics['average-delay']).toMatchObject({ value: null, sampleSize: 2 })
    expect(metrics['overdue-open']).toMatchObject({
      value: 1,
      sampleSize: 2,
      population: 'open',
      shipmentIds: [fx.d.id],
    })
    expect(metrics['site-pickup:site-madrid']).toMatchObject({ value: 2.3, sampleSize: 3 })
    expect(metrics['site-pickup-open:site-zaragoza']).toMatchObject({
      value: 100,
      population: 'open',
      shipmentIds: [fx.d.id],
    })
    // One completed observation is below the minimum: the value is withheld, the sample kept.
    expect(metrics['site-pickup:site-zaragoza']).toMatchObject({ value: null, sampleSize: 1 })
    expect(metrics['port-dwell:port-valencia']).toMatchObject({
      value: null,
      sampleSize: 1,
      shipmentIds: [fx.e.id],
    })
    expect(metrics['port-dwell-open:port-valencia']).toMatchObject({
      value: 10,
      sampleSize: 1,
      shipmentIds: [fx.f.id],
    })
    expect(metrics['customs-time:port-mersin']).toMatchObject({ value: null, sampleSize: 1 })
    expect(result).toMatchObject({ generatedAt: reportCutoff, datasetRevision: 7, findings: [] })
    expect(result.limitations).toContain(
      '1 envíos sin eventos del operador; no aportan duraciones.',
    )
    expect(MIN_COMPLETED_SAMPLE).toBe(3)
  })

  it('nunca mezcla esperas abiertas con duraciones completadas', () => {
    for (const metric of report().metrics) {
      expect(metric.id.includes('-open') || metric.id === 'overdue-open').toBe(
        metric.population === 'open',
      )
      expect(metric.group).toBeTruthy()
    }
  })

  it('aplica periodo, centros y operadores', () => {
    const zaragoza = byId(report({ originSiteIds: ['site-zaragoza'] }).metrics)
    expect(zaragoza['on-time-rate']).toMatchObject({ value: null, sampleSize: 1 })
    expect(zaragoza['site-pickup:site-madrid']).toBeUndefined()

    const boreal = report({ operatorIds: ['operator-boreal'] })
    const ids = new Set(boreal.metrics.flatMap((metric) => metric.shipmentIds))
    expect([...ids].sort()).toEqual([fx.e.id, fx.f.id])
    expect(
      boreal.metrics.filter((metric) => metric.group === 'operators').map((m) => m.id),
    ).toEqual(['operator-transit:operator-boreal'])

    // F was created at hour 70: a period ending at hour 60 leaves it out.
    const early = byId(report({ to: iso(60) }).metrics)
    expect(early['port-dwell-open:port-valencia']).toBeUndefined()
    expect(early['overdue-open']).toMatchObject({ sampleSize: 1, shipmentIds: [fx.d.id] })

    expect(report({ from: iso(500), to: iso(600) }).limitations).toContain(
      'No hay envíos visibles con los filtros aplicados.',
    )
  })

  it('es determinista', () => {
    expect(report()).toEqual(report())
  })
})
