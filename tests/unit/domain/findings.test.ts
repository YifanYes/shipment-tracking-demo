import { describe, expect, it } from 'vitest'
import { demoSeed } from '@/data/scenarios'
import { buildLogisticsReport, defaultAnalyticsFilters } from '@/domain/analytics'
import { MAX_FINDINGS } from '@/domain/findings'
import { selectVisibleShipments } from '@/domain/selectors'

const { referenceTime } = demoSeed.dataset
const report = (identityId: string, originSiteIds: string[] = []) => {
  const shipments = selectVisibleShipments({
    dataset: demoSeed.dataset,
    identityId,
    cutoffAt: referenceTime,
    selectedShipmentId: null,
  })
  return {
    shipments,
    report: buildLogisticsReport({
      identityId,
      shipments,
      filters: { ...defaultAnalyticsFilters(referenceTime), originSiteIds },
      cutoffAt: referenceTime,
      datasetRevision: demoSeed.dataset.revision,
    }),
  }
}

describe('hallazgos del reporte', () => {
  it('detecta los cuellos de botella del histórico sin atribuirlos al operador', () => {
    const { report: result } = report('operations-network')
    const byId = new Map(result.findings.map((finding) => [finding.id, finding]))
    expect(byId.get('finding-bottleneck-port-dwell')?.title).toContain('Puerto de Valencia')
    expect(byId.get('finding-bottleneck-customs-time')?.title).toContain('Puerto de Felixstowe')
    expect(byId.get('finding-bottleneck-site-pickup')?.title).toContain('Plataforma Zaragoza')
    for (const id of ['port-dwell', 'customs-time', 'site-pickup']) {
      const finding = byId.get(`finding-bottleneck-${id}`)!
      expect(finding.limitations.some((item) => item.includes('no se atribuye al operador'))).toBe(
        true,
      )
      expect(finding.assumptions[0]).toMatch(/^Ahorro estimado: .* por envío/)
    }
    // Only bottlenecks, at most three, urgent first.
    expect(result.findings.length).toBeLessThanOrEqual(MAX_FINDINGS)
    expect(result.findings.every((item) => item.id.startsWith('finding-bottleneck-'))).toBe(true)
    const priorities = result.findings.map((finding) => finding.priority)
    expect(priorities).toEqual(
      [...priorities].sort((a, b) => (a === b ? 0 : a === 'urgent' ? -1 : 1)),
    )
  })

  it('cada hallazgo coincide con sus métricas y enlaza envíos visibles', () => {
    for (const identityId of ['operations-network', 'operations-madrid']) {
      const { report: result, shipments } = report(identityId)
      const visible = new Set(shipments.map((view) => view.shipment.id))
      const metrics = new Map(result.metrics.map((metric) => [metric.id, metric]))
      expect(result.findings.length).toBeGreaterThan(0)
      for (const finding of result.findings) {
        expect(finding.metricIds.every((id) => metrics.has(id))).toBe(true)
        const supported = new Set(finding.metricIds.flatMap((id) => metrics.get(id)!.shipmentIds))
        for (const evidence of finding.evidence) {
          expect(evidence.kind).toBe('shipment')
          expect(visible.has(evidence.id)).toBe(true)
          expect(supported.has(evidence.id)).toBe(true)
        }
      }
      const port = result.findings.find((item) => item.id === 'finding-bottleneck-port-dwell')!
      const valencia = metrics.get('port-dwell:port-valencia')!
      expect(port.title).toContain(String(valencia.value).replace('.', ','))
      expect(port.evidence.map((item) => item.id)).toEqual(valencia.shipmentIds)
    }
  })

  it('los filtros cambian los hallazgos', () => {
    const { report: result } = report('operations-network', ['site-madrid'])
    expect(result.findings.some((item) => item.id === 'finding-bottleneck-site-pickup')).toBe(false)
  })
})
