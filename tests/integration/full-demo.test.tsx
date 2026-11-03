// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '@/app/app'
import { demoSeed } from '@/data/scenarios'
import { selectSummary, selectVisibleShipments } from '@/domain/selectors'
import { useWorkspaceStore } from '@/store/workspace-store'
import { PLAY_STEP_MS } from '@/simulation/clock'

vi.mock(
  '@/features/overview/components/logistics-map',
  () => import('@tests/support/logistics-map-mock'),
)

let root: Root
let container: HTMLDivElement
const mount = async () => {
  await act(async () => root.render(<App />))
  await act(async () => {
    await vi.dynamicImportSettled()
  })
}
const setIdentity = async (id: string) => {
  await act(async () => {
    const select = container.querySelector<HTMLSelectElement>('select[aria-label="Identidad"]')!
    select.value = id
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}
const markers = () =>
  [...container.querySelectorAll('[data-testid="map"] button')]
    .map((element) => element.textContent ?? '')
    .filter((text) => text.startsWith('Marcador '))
    .map((text) => text.replace('Marcador ', ''))

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  useWorkspaceStore.setState({ seed: demoSeed })
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

describe('demo completa', () => {
  it('mapa, contadores y listado derivan de las mismas vistas autorizadas', async () => {
    await mount()
    const state = useWorkspaceStore.getState()
    const views = selectVisibleShipments(state)
    const pending = views.filter((item) => item.projection.lifecycle !== 'delivered')
    expect(pending.length).toBeGreaterThan(5)
    expect(container.querySelector('.map-shipment-count')?.textContent).toBe(String(pending.length))
    expect(markers().sort()).toEqual(
      pending
        .filter((item) => item.projection.lastConfirmedLocation)
        .map((item) => item.shipment.reference)
        .sort(),
    )
    const summary = selectSummary(views, state.cutoffAt)
    const metrics = [...container.querySelectorAll('.metric-value')].map((item) => item.textContent)
    expect(metrics.slice(0, 2)).toEqual([String(summary.active), String(summary.attention)])
    expect(container.querySelectorAll('.attention-item')).toHaveLength(summary.attention)
  })

  it('el cliente solo ve su cuenta y no abre envíos ajenos por URL', async () => {
    await mount()
    await setIdentity('customer-levante')
    expect(container.querySelector('[data-testid="map"]')).toBeNull()
    const foreign = demoSeed.dataset.shipments.find((item) => item.accountId !== 'account-levante')!
    const own = selectVisibleShipments(useWorkspaceStore.getState())
    expect(own.length).toBeGreaterThan(0)
    expect(own.every((item) => item.shipment.accountId === 'account-levante')).toBe(true)
    expect(container.textContent).not.toContain(foreign.reference)
    await act(async () => {
      window.history.pushState(null, '', `/shipments/${foreign.id}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(container.querySelector('#detail-title')).toBeNull()
    expect(window.location.pathname).toBe('/shipments')
    expect(container.querySelector('nav')?.textContent).not.toContain('Análisis')
  })

  it('la retención aduanera de ATL-TR-004 se mantiene hasta su evento de liberación', async () => {
    useWorkspaceStore.getState().setIdentity('operations-network')
    window.history.replaceState(null, '', '/shipments/shipment-tr-004')
    await mount()
    expect(container.querySelector('#detail-title')?.textContent).toBe('ATL-TR-004')
    expect(container.querySelector('.detail-status')?.textContent).toContain('En aduana')
    const release = demoSeed.scenarios
      .find((scenario) => scenario.id === 'customs-hold')!
      .scheduledEvents.find((item) => item.event.rawCode === 'CUSTOMS_RELEASED')!
    const releaseAt = Date.parse(demoSeed.dataset.referenceTime) + release.offsetMinutes * 60_000
    while (Date.parse(useWorkspaceStore.getState().cutoffAt) < releaseAt) {
      expect(container.querySelector('.detail-status')?.textContent).toContain('En aduana')
      await act(async () => useWorkspaceStore.getState().advanceDemo())
    }
    expect(container.querySelector('.detail-status')?.textContent).not.toContain('En aduana')
    expect(container.querySelector('.event-list')?.textContent).toContain('CUSTOMS_RELEASED')
  })

  it('avisa con un toast de lo ocurrido y solo cuenta la historia si el envío es visible', async () => {
    const advance = async () =>
      act(async () =>
        container.querySelector<HTMLButtonElement>('button[aria-label^="Siguiente paso"]')!.click(),
      )
    useWorkspaceStore.getState().setIdentity('operations-network')
    await mount()
    await advance()
    expect(document.body.textContent).toContain('ATL-IT-003 llegará tarde a Milán')
    expect(document.body.textContent).toContain('Además, 1 envío entregado.')
    expect(
      container.querySelector('button[aria-label^="Siguiente paso"]')?.getAttribute('aria-label'),
    ).toBe('Siguiente paso: Respuesta del operador de ATL-ES-005')

    // Resetting from the sidebar also clears the toasts.
    await act(async () =>
      container.querySelector<HTMLButtonElement>('button[aria-label="Reiniciar"]')!.click(),
    )
    await act(async () => useWorkspaceStore.getState().setIdentity('operations-madrid'))
    await advance()
    expect(document.body.textContent).toContain('Retraso marítimo de ATL-IT-003')
    expect(document.body.textContent).not.toContain('Naviera Boreal')
  })

  it('una incidencia recorre bandeja, detalle, acciones y aviso del cliente', async () => {
    useWorkspaceStore.getState().setIdentity('operations-network')
    await mount()
    const queued = [...container.querySelectorAll('.attention-item')].find((item) =>
      item.textContent?.includes('ATL-TR-004'),
    )
    expect(queued?.textContent).toContain('Retenido en aduana')
    await act(async () => useWorkspaceStore.getState().selectShipment('shipment-tr-004'))
    const card = () =>
      [...container.querySelectorAll('.incident-card')].find(
        (item) => item.querySelector('.incident-heading strong')?.textContent === 'Aduana',
      )!
    expect(card().textContent).toContain('Retenido en la aduana de Mersin')
    const click = async (label: string, scope: ParentNode = container) =>
      act(async () =>
        [...scope.querySelectorAll('button')]
          .find((button) => button.textContent?.trim() === label)!
          .click(),
      )

    await click('Aportar documento')
    const certificate = [...container.querySelectorAll('.document-item')].find((item) =>
      item.textContent?.includes('A.TR'),
    )
    expect(certificate?.textContent).toContain('Disponible')
    expect(container.querySelector('.detail-status')?.textContent).toContain('En aduana')

    await click('Preparar aviso', card())
    const dialog = document.body.querySelector('[data-slot="dialog-content"]')!
    expect(dialog.textContent).toContain('Para: Levante Retail')
    await click('Registrar aviso', dialog)
    expect(document.body.querySelector('[data-slot="dialog-content"]')).toBeNull()
    expect(container.querySelector('.activity-panel')?.textContent).toContain(
      'Aviso al cliente · Levante Retail',
    )
    expect(card().textContent).toContain('En gestión')

    await setIdentity('customer-levante')
    const notices = container.querySelector('.customer-notices')
    expect(notices?.textContent).toContain('ATL-TR-004: retenido en la aduana de Mersin')
    expect(container.textContent).not.toContain('Solicitud al operador')
  })

  it('reproduce los pasos con pausa entre ellos y se detiene al pausar', async () => {
    vi.useFakeTimers()
    try {
      useWorkspaceStore.getState().setIdentity('operations-network')
      await mount()
      const button = (label: string) =>
        container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!
      await act(async () => button('Reproducir').click())
      const first = useWorkspaceStore.getState().cutoffAt
      expect(first).not.toBe(demoSeed.dataset.referenceTime)
      await act(async () => vi.advanceTimersByTime(PLAY_STEP_MS))
      const second = useWorkspaceStore.getState().cutoffAt
      expect(Date.parse(second)).toBeGreaterThan(Date.parse(first))
      await act(async () => button('Pausar').click())
      await act(async () => vi.advanceTimersByTime(PLAY_STEP_MS * 3))
      expect(useWorkspaceStore.getState().cutoffAt).toBe(second)
      await act(async () => button('Reproducir').click())
      for (let step = 0; step < demoSeed.steps.length; step++)
        await act(async () => vi.advanceTimersByTime(PLAY_STEP_MS))
      expect(button('Demo completada').disabled).toBe(true)
      expect(useWorkspaceStore.getState().playing).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})
