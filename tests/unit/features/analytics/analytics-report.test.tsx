// @vitest-environment jsdom
import { act } from 'react'
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
  queryMs: 0,
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
          id: 'overdue-open',
          group: 'delays',
          label: 'Envíos en curso fuera de plazo',
          definition: 'Envíos sin entregar tras la fecha comprometida.',
          unit: 'shipments',
          value: null,
          sampleSize: 1,
          population: 'open',
          shipmentIds: ['shipment-customs', 'shipment-outside-perimeter'],
        },
        {
          id: 'customs-time:port-mersin',
          group: 'customs',
          label: 'Despacho aduanero en Puerto de Mersin',
          definition: 'Horas entre la declaración y la liberación.',
          unit: 'hours',
          value: 12,
          sampleSize: 4,
          population: 'completed',
          shipmentIds: ['shipment-customs'],
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
    const origins = container.querySelector('.analytics-chips')!
    expect(origins.textContent).toContain('Centro Madrid')
    expect(origins.textContent).toContain('Centro Zaragoza')
    // No chip pressed but "Todos": the report covers everything visible.
    expect(buttonByText(origins as HTMLElement, 'Todos')?.getAttribute('aria-pressed')).toBe('true')
    expect(buttonByText(container, 'Generar reporte')).toBeDefined()
  })

  it('genera con los filtros aplicados y marca la muestra insuficiente', () => {
    view = renderView(AnalyticsReport, props)
    const { container } = view
    const origins = container.querySelector<HTMLElement>('.analytics-chips')!
    click(buttonByText(origins, 'Centro Madrid'))
    expect(buttonByText(origins, 'Todos')?.getAttribute('aria-pressed')).toBe('false')
    click(buttonByText(container, 'Generar reporte'))
    const input = build.mock.calls[0]![0]
    expect(input.filters.originSiteIds).toEqual(['site-madrid'])
    expect(input.filters.to).toBe(viewCutoffAt)
    const kpi = container.querySelector('.report-kpi')!
    expect(kpi.textContent).toContain('En curso fuera de plazo')
    expect(kpi.textContent).toContain('Muestra insuficiente')
    expect(container.querySelector('.report-meta')?.textContent).toContain('Centro Madrid')
    expect(container.querySelector('.report-nodes')?.textContent).toContain('Despacho aduanero')
    expect(container.querySelector('.report-nodes')?.textContent).toContain('12 h')
    // Only shipments inside the perimeter are linked.
    const links = [...kpi.querySelectorAll('.report-shipments button')]
    expect(links.map((link) => link.textContent)).toEqual(['ATL-IT-301'])
    click(links[0])
    expect(props.onOpenShipment).toHaveBeenCalledWith('shipment-customs')
    expect(container.textContent).not.toContain('Hallazgos')
    expect(container.textContent).toContain('Sin eventos de liberación en el periodo.')
  })

  it('simula la consulta antes de mostrar el reporte', () => {
    vi.useFakeTimers()
    try {
      view = renderView(AnalyticsReport, { ...props, queryMs: 1800 })
      const { container } = view
      click(buttonByText(container, 'Generar reporte'))
      expect(build).not.toHaveBeenCalled()
      const loading = container.querySelector('.report-loading')!
      expect(loading.getAttribute('aria-busy')).toBe('true')
      expect(loading.textContent).toMatch(/Consultando eventos de \d+ envíos/)
      expect(buttonByText(container, 'Generar reporte')?.getAttribute('aria-disabled')).toBe('true')
      act(() => {
        vi.advanceTimersByTime(1800)
      })
      expect(build).toHaveBeenCalledTimes(1)
      expect(container.querySelector('.report-loading')).toBeNull()
      expect(container.querySelector('.report')).not.toBeNull()
    } finally {
      vi.useRealTimers()
    }
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
