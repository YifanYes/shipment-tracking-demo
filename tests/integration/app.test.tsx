// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '@/app/app'
import { useWorkspaceStore } from '@/store/workspace-store'
import { nationalDataset } from '@/data/scenarios/national'
import { nationalSeed } from '@/data/scenarios'

// The map renderer is checked in the browser; the real overview handles selection and permissions.
vi.mock(
  '@/features/overview/components/logistics-map',
  () => import('@tests/support/logistics-map-mock'),
)

let root: Root
let container: HTMLDivElement
const button = (text: string) => {
  const element = [...container.querySelectorAll('button')].find(
    (entry) =>
      entry.textContent?.includes(text) || entry.getAttribute('aria-label')?.includes(text),
  )
  if (!element) throw new Error(`Botón no encontrado: ${text}`)
  return element
}
const click = async (text: string) => {
  await act(async () => button(text).click())
}
const mount = async () => {
  await act(async () => {
    root.render(<App />)
  })
  // The map is lazy-loaded; let its (mocked) module resolve before asserting.
  await act(async () => {
    await vi.dynamicImportSettled()
  })
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  // Phase 1 walkthrough runs on the single-shipment seed; the full dataset has its own tests.
  useWorkspaceStore.setState({ seed: nationalSeed })
  useWorkspaceStore.getState().setIdentity('operations-madrid')
  useWorkspaceStore.getState().resetDemo()
  window.history.replaceState(null, '', '/')
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('primer recorrido de Atlas', () => {
  it('selecciona el recorrido sin salir de vista general y muestra la fuente y antigüedad', async () => {
    await mount()
    expect(container.querySelector('.map-shipment-count')?.textContent).toBe('1')
    expect(container.querySelector('.map-tabs')).toBeNull()
    expect(container.querySelector('.map-legend')?.textContent).not.toContain('Entregado')
    await click('Marcador ATL-ES-001')
    expect(window.location.pathname).toBe('/')
    const summary = container.querySelector('.map-selected')
    expect(summary?.textContent).toContain('A-3 · Perales de Tajuña')
    expect(summary?.textContent).toContain('Actualizado hace 1 min')
    expect(summary?.textContent).toContain('Comunicada por Vía Cargo')
    await click('Cerrar selección del mapa')
    expect(container.querySelector('.map-selected')).toBeNull()
  })

  it('localiza un envío desde atención y conserva el acceso cuando faltan coordenadas', async () => {
    useWorkspaceStore.setState({
      cutoffAt: '2026-10-31T15:00:00Z',
      dataset: {
        ...nationalDataset,
        locations: nationalDataset.locations.map((location) => ({
          ...location,
          coordinates: undefined,
        })),
      },
    })
    await mount()
    expect(container.querySelectorAll('.attention-item')).toHaveLength(1)
    expect(container.querySelector('.attention-item')?.textContent).toContain(
      'Información sin actualizar',
    )
    expect(container.querySelector('.attention-item')?.textContent).toContain(
      'Entrega pendiente fuera de plazo',
    )
    expect(container.querySelector('.map-shipment-row')?.textContent).toContain(
      'Sin coordenadas disponibles',
    )
    await click('Localizar envío')
    expect(container.querySelector('.map-selected')?.textContent).toContain(
      'A-3 · Perales de Tajuña',
    )
    await click('Abrir detalle')
    expect(container.querySelector('#detail-title')?.textContent).toBe('ATL-ES-001')
  })

  it('abre una vista propia desde mapa y listado y propaga la entrega a todas las vistas', async () => {
    await mount()
    await click('Marcador ATL-ES-001')
    await click('Abrir detalle')
    expect(container.querySelector('#detail-title')?.textContent).toBe('ATL-ES-001')
    expect(document.activeElement?.id).toBe('detail-title')
    expect(window.location.pathname).toBe('/shipments/shipment-es-001')
    expect(document.title).toBe('ATL-ES-001 | Atlas')
    expect(container.querySelector('.shipment-row')).toBeNull()
    expect(container.querySelector('[data-testid="map"]')).toBeNull()
    await click('Volver a envíos')
    expect(window.location.pathname).toBe('/shipments')
    expect(container.querySelector('#detail-title')).toBeNull()
    await act(async () => container.querySelector<HTMLAnchorElement>('.shipment-row')!.click())
    expect(container.querySelector('#detail-title')?.textContent).toBe('ATL-ES-001')
    expect(container.querySelector('.shipment-row')).toBeNull()
    await click('Siguiente paso')
    expect(container.querySelector('.detail-status')?.textContent).toContain('Entregado')
    expect(container.querySelector('.detail-facts')?.textContent).toContain('Almacén Valencia')
    const timeline = container.querySelectorAll('.event-list li')
    expect(timeline).toHaveLength(3)
    expect(timeline[0]?.textContent).toContain('DELIVERED')
    expect(timeline[1]?.textContent).toContain('ON_ROUTE')
    expect(timeline[2]?.textContent).toContain('PICKED_UP')
    expect(button('Demo completada').disabled).toBe(true)
    await click('Volver a envíos')
    expect(container.querySelector('.shipment-row')?.textContent).toContain('Entregado')
    await click('Vista general')
    expect(container.textContent).toContain('Sin envíos pendientes de entrega')
    expect(container.querySelector('.map-shipment-count')?.textContent).toBe('0')
    expect(container.querySelector('[data-testid="map"]')?.children).toHaveLength(0)
    expect(container.querySelector('.map-shipment-row')).toBeNull()
    expect(
      [...container.querySelectorAll('.metric-value')].map((element) => element.textContent),
    ).toEqual(['0', '0', '0'])
    await click('Reiniciar')
    await click('Envíos')
    expect(container.querySelector('.shipment-row')?.textContent).toContain('En tránsito')
  })

  it('retira detalle, ruta y contadores al cambiar de identidad y rechaza un enlace ajeno', async () => {
    await mount()
    await click('Marcador ATL-ES-001')
    await click('Abrir detalle')
    await act(async () => {
      const select = container.querySelector('select')!
      select.value = 'customer-levante'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(container.textContent).not.toContain('ATL-ES-001')
    expect(container.textContent).not.toContain('Norte Hogar')
    expect(container.querySelector('#detail-title')).toBeNull()
    expect(container.querySelector('[data-testid="map"]')).toBeNull()
    expect(window.location.search).toBe('')
    await act(async () => {
      window.history.pushState(null, '', '?shipment=shipment-es-001')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(container.textContent).not.toContain('ATL-ES-001')
    expect(window.location.search).toBe('')
    await click('Envíos')
    expect(container.textContent).toContain('No hay envíos en tu perímetro')
  })

  it('abre una URL autorizada y limpia un identificador inexistente', async () => {
    window.history.replaceState(null, '', '/shipments/shipment-es-001')
    await mount()
    expect(container.querySelector('#detail-title')?.textContent).toBe('ATL-ES-001')
    await act(async () => {
      window.history.pushState(null, '', '/shipments/missing')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(container.querySelector('#detail-title')).toBeNull()
    expect(window.location.pathname).toBe('/shipments')
    expect(container.querySelector('.shipment-row')).not.toBeNull()
  })

  it('restaura listado y detalle al navegar por el historial y mantiene enlaces anteriores', async () => {
    window.history.replaceState(null, '', '?shipment=shipment-es-001')
    await mount()
    expect(window.location.pathname).toBe('/shipments/shipment-es-001')
    await act(async () => {
      window.history.replaceState(null, '', '/shipments')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(container.querySelector('.shipment-row')).not.toBeNull()
    expect(container.querySelector('#detail-title')).toBeNull()
    await act(async () => {
      window.history.replaceState(null, '', '/shipments/shipment-es-001')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(container.querySelector('#detail-title')?.textContent).toBe('ATL-ES-001')
    expect(container.querySelector('.shipment-row')).toBeNull()
  })
})
