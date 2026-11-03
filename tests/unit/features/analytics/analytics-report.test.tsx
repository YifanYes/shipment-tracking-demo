// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LogisticsReport, ShipmentView } from '@/domain/contracts'
import { buildLogisticsReport } from '@/domain/analytics'
import { AnalyticsReport } from '@/features/analytics'
import {
  allViews,
  buttonByText,
  click,
  renderView,
  viewCutoffAt,
} from '@tests/support/view-fixtures'

vi.mock('@/domain/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/domain/analytics')>()),
  buildLogisticsReport: vi.fn(),
}))

const build = vi.mocked(buildLogisticsReport)
const props = {
  shipments: allViews as readonly ShipmentView[],
  identityId: 'operations-madrid',
  cutoffAt: viewCutoffAt,
  datasetRevision: 1,
  onOpenShipment: vi.fn(),
}
let view: ReturnType<typeof renderView<typeof props>> | undefined

beforeEach(() => {
  build.mockReset()
  build.mockImplementation((input) => {
    const report: LogisticsReport = {
      id: 'report',
      identityId: input.identityId,
      generatedAt: input.cutoffAt,
      cutoffAt: input.cutoffAt,
      filters: input.filters,
      datasetRevision: input.datasetRevision,
      metrics: [
        {
          id: 'wait.customs.open',
          group: 'customs',
          label: 'Espera abierta en aduana',
          definition: 'Horas desde la retención hasta el corte.',
          unit: 'hours',
          value: null,
          sampleSize: 1,
          population: 'open',
          shipmentIds: ['shipment-customs', 'shipment-outside-perimeter'],
        },
      ],
      findings: [],
      limitations: ['Sin eventos de liberación en el periodo.'],
    }
    return report
  })
})
afterEach(() => view?.unmount())

describe('reporte de análisis logístico', () => {
  it('antes de generar solo muestra filtros con opciones visibles y la acción', () => {
    view = renderView(AnalyticsReport, props)
    const { container } = view
    expect(container.querySelector('.report')).toBeNull()
    const origins = [...container.querySelectorAll('.analytics-options')][0]!
    expect(origins.textContent).toContain('Centro Madrid')
    expect(origins.textContent).toContain('Centro Zaragoza')
    expect(buttonByText(container, 'Generar reporte')).toBeDefined()
  })

  it('genera con los filtros aplicados y marca la muestra insuficiente', () => {
    view = renderView(AnalyticsReport, props)
    const { container } = view
    click(container.querySelector('.analytics-options input[type="checkbox"]'))
    click(buttonByText(container, 'Generar reporte'))
    const input = build.mock.calls[0]![0]
    expect(input.filters.originSiteIds).toEqual(['site-madrid'])
    expect(input.filters.to).toBe(viewCutoffAt)
    const metric = container.querySelector('.report-metric')!
    expect(metric.textContent).toContain('Muestra insuficiente')
    expect(metric.textContent).toContain('Muestra: 1 envío')
    expect(container.querySelector('.report-population')?.textContent).toContain('Esperas abiertas')
    expect(container.querySelector('.report-meta')?.textContent).toContain('Centro Madrid')
    // Only shipments inside the perimeter are linked.
    const links = [...metric.querySelectorAll('.report-shipments button')]
    expect(links.map((link) => link.textContent)).toEqual(['ATL-IT-301'])
    click(links[0])
    expect(props.onOpenShipment).toHaveBeenCalledWith('shipment-customs')
    expect(container.textContent).not.toContain('Hallazgos')
    expect(container.textContent).toContain('Sin eventos de liberación en el periodo.')
  })

  it('marca el reporte como desactualizado al avanzar el corte y lo regenera', () => {
    view = renderView(AnalyticsReport, props)
    click(buttonByText(view.container, 'Generar reporte'))
    expect(view.container.querySelector('.report-outdated')).toBeNull()
    void view.rerender({ ...props, cutoffAt: '2026-10-31T12:00:00Z' })
    expect(view.container.querySelector('.report-outdated')).not.toBeNull()
    void view.rerender({ ...props, cutoffAt: '2026-10-31T12:00:00Z', datasetRevision: 2 })
    click(buttonByText(view.container, 'Regenerar'))
    expect(build).toHaveBeenCalledTimes(2)
    expect(build.mock.calls[1]![0].datasetRevision).toBe(2)
    expect(view.container.querySelector('.report-outdated')).toBeNull()
  })

  it('muestra el error de generación', () => {
    build.mockImplementation(() => {
      throw new Error('Datos incompletos')
    })
    view = renderView(AnalyticsReport, props)
    click(buttonByText(view.container, 'Generar reporte'))
    expect(view.container.querySelector('[role="alert"]')?.textContent).toContain(
      'Datos incompletos',
    )
  })

  it('muestra el vacío sin histórico', () => {
    const mounted = renderView<typeof props>(AnalyticsReport, { ...props, shipments: [] })
    view = mounted
    expect(mounted.container.textContent).toContain('No hay histórico de envíos')
  })
})
