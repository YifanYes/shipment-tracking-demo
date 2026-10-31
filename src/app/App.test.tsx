// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ShipmentView } from '@/domain/selectors'
import { App } from './App'
import { useWorkspaceStore } from '@/store/use-workspace-store'

// WebGL is checked in the real browser. This verifies the scene's input/callback contract.
vi.mock('@/scene/NetworkPreview', () => ({
  default: ({
    shipments,
    selectedId,
    onSelect,
  }: {
    shipments: ShipmentView[]
    selectedId: string | null
    onSelect: (id: string) => void
  }) => (
    <div data-testid="scene">
      {shipments.map(({ shipment, projection }) => (
        <button
          key={shipment.id}
          data-stage={projection.currentStage}
          aria-pressed={selectedId === shipment.id}
          onClick={() => onSelect(shipment.id)}
        >
          Vehículo {shipment.reference}
        </button>
      ))}
    </div>
  ),
}))

let root: Root
let container: HTMLDivElement
const button = (text: string) => {
  const element = [...container.querySelectorAll('button')].find((entry) =>
    entry.textContent?.includes(text),
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
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
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
  it('abre una vista propia desde escena y listado y propaga la entrega a todas las vistas', async () => {
    await mount()
    await click('Vehículo ATL-ES-001')
    expect(container.querySelector('#detail-title')?.textContent).toBe('ATL-ES-001')
    expect(document.activeElement?.id).toBe('detail-title')
    expect(window.location.pathname).toBe('/shipments/shipment-es-001')
    expect(document.title).toBe('ATL-ES-001 | Atlas')
    expect(container.querySelector('.shipment-row')).toBeNull()
    expect(container.querySelector('[data-testid="scene"]')).toBeNull()
    await click('Volver a envíos')
    expect(window.location.pathname).toBe('/shipments')
    expect(container.querySelector('#detail-title')).toBeNull()
    await act(async () => container.querySelector<HTMLAnchorElement>('.shipment-row')!.click())
    expect(container.querySelector('#detail-title')?.textContent).toBe('ATL-ES-001')
    expect(container.querySelector('.shipment-row')).toBeNull()
    await click('Confirmar entrega')
    expect(container.querySelector('.detail-status')?.textContent).toContain('Entregado')
    expect(container.querySelector('.detail-facts')?.textContent).toContain('Almacén Valencia')
    const timeline = container.querySelectorAll('.event-list li')
    expect(timeline).toHaveLength(3)
    expect(timeline[0]?.textContent).toContain('DELIVERED')
    expect(timeline[1]?.textContent).toContain('ON_ROUTE')
    expect(timeline[2]?.textContent).toContain('PICKED_UP')
    expect(button('Confirmar entrega').disabled).toBe(true)
    await click('Volver a envíos')
    expect(container.querySelector('.shipment-row')?.textContent).toContain('Entregado')
    await click('Vista general')
    expect(
      container.querySelector('[data-testid="scene"] button')?.getAttribute('data-stage'),
    ).toBe('completed')
    expect(
      [...container.querySelectorAll('.metric-value')].map((element) => element.textContent),
    ).toEqual(['0', '0', '0'])
    await click('Reiniciar')
    await click('Envíos')
    expect(container.querySelector('.shipment-row')?.textContent).toContain('En tránsito')
  })

  it('retira detalle, ruta y contadores al cambiar de identidad y rechaza un enlace ajeno', async () => {
    await mount()
    await click('Vehículo ATL-ES-001')
    await act(async () => {
      const select = container.querySelector('select')!
      select.value = 'customer-levante'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(container.textContent).not.toContain('ATL-ES-001')
    expect(container.textContent).not.toContain('Norte Hogar')
    expect(container.querySelector('#detail-title')).toBeNull()
    expect(container.querySelector('[data-testid="scene"]')?.children).toHaveLength(0)
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
