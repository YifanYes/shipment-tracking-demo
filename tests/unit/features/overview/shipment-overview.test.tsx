// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShipmentOverview } from '@/features/overview'
import { mapCutoffAt, mapShipments } from '@tests/support/map-fixtures'

vi.mock(
  '@/features/overview/components/logistics-map',
  () => import('@tests/support/logistics-map-mock'),
)

let root: Root
let container: HTMLDivElement
const onOpenShipment = vi.fn()
const text = (selector: string) =>
  [...container.querySelectorAll(selector)].map((element) => element.textContent ?? '')
const click = async (label: string) => {
  const element = [...container.querySelectorAll('button')].find(
    (entry) => entry.textContent?.includes(label) || entry.getAttribute('aria-label') === label,
  )
  if (!element) throw new Error(`Botón no encontrado: ${label}`)
  await act(async () => element.click())
}

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => {
    root.render(
      <ShipmentOverview
        shipments={mapShipments}
        cutoffAt={mapCutoffAt}
        onOpenShipment={onOpenShipment}
      />,
    )
  })
  await act(async () => {
    await vi.dynamicImportSettled()
  })
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  onOpenShipment.mockReset()
})

describe('vista general multimodal', () => {
  it('excluye el histórico del mapa y ordena la atención por gravedad', () => {
    expect(container.querySelector('.map-shipment-count')?.textContent).toBe('4')
    expect(text('.map-shipment-row').join()).not.toContain('ATL-ES-090')
    expect(text('.attention-item strong')).toEqual(['ATL-MM-002', 'ATL-MM-001'])
    expect(text('.attention-item li')).toEqual(['Retenido en aduana · crítica', 'Retraso · alta'])
    expect(container.querySelector('.map-legend')?.textContent).toContain('Marítimo')
    expect(container.querySelector('.map-legend')?.textContent).toContain('Puerto')
  })

  it('filtra la lista por un puerto y vuelve a mostrar todos', async () => {
    await click('Filtrar envíos por Tanger Med')
    expect(container.querySelector('.map-list-heading')?.textContent).toContain(
      'Puerto · Tanger Med',
    )
    expect(text('.map-row-reference strong')).toEqual(['ATL-MM-001', 'ATL-MM-002'])
    await click('Ver todos')
    expect(container.querySelectorAll('.map-shipment-row')).toHaveLength(4)
    expect(container.querySelector('.map-list-heading')).toBeNull()
  })

  it('quita el filtro si se localiza un envío que no pasa por el lugar', async () => {
    await click('Filtrar envíos por Puerto de Valencia')
    expect(container.querySelectorAll('.map-shipment-row')).toHaveLength(1)
    await click('ATL-MM-002')
    expect(container.querySelector('.map-list-heading')).toBeNull()
    expect(container.querySelector('.map-selected')?.getAttribute('aria-label')).toBe(
      'Resumen de ATL-MM-002',
    )
  })

  it('resume el recorrido por tramos, la previsión y las incidencias del envío', async () => {
    await click('Marcador ATL-MM-001')
    const card = container.querySelector('.map-selected')!
    expect(text('.map-selected-route li')).toEqual([
      'Madrid',
      'Carretera, completado: Valencia',
      'Marítimo, en curso: Tánger',
      'Carretera, pendiente: Casablanca',
    ])
    expect(card.textContent).toContain('Mar de Alborán')
    expect(card.textContent).toContain('Mare Lines · Actualizado hace 1 h')
    expect(card.textContent).toContain('Intervalo estimado')
    expect(card.textContent).toContain('Fecha comprometida')
    expect(text('.map-selected-incidents dd')).toEqual(['Retraso · alta'])
    await click('Abrir detalle')
    expect(onOpenShipment).toHaveBeenCalledWith('shipment-multi')
  })

  it('explica la previsión no disponible y conserva el acceso sin coordenadas', async () => {
    await click('ATL-ES-102')
    const card = container.querySelector('.map-selected')!
    expect(card.textContent).toContain('Sin previsión')
    expect(card.textContent).toContain('Sin datos del operador marítimo')
    expect(card.querySelector('.map-selected-incidents')).toBeNull()
  })
})
