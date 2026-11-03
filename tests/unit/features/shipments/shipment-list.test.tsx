// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShipmentList } from '@/features/shipments'
import type { ShipmentView } from '@/domain/contracts'
import {
  allViews,
  buttonByText,
  changeValue,
  click,
  delivered,
  makeView,
  renderView,
  type MountedView,
  selectByLabel,
  staleUnknown,
  viewCutoffAt,
} from '@tests/support/view-fixtures'

let view: MountedView | undefined
afterEach(() => view?.unmount())

const rows = () => [...view!.container.querySelectorAll('.shipment-row')]
const render = (shipments: readonly ShipmentView[], audience: 'operations' | 'customer') => {
  const onSelect = vi.fn()
  view = renderView(ShipmentList, { shipments, cutoffAt: viewCutoffAt, audience, onSelect })
  return onSelect
}

describe('listado de envíos', () => {
  it('muestra modos de los tramos, tipo de ETA y motivos de atención', () => {
    render(allViews, 'operations')
    const sea = rows().find((row) => row.textContent?.includes('ATL-IT-201'))!
    expect(sea.textContent).toContain('Carretera + Mar')
    expect(sea.textContent).toContain('ETA del operador')
    const stale = rows().find((row) => row.textContent?.includes('ATL-ES-401'))!
    expect(stale.textContent).toContain('Sin previsión')
    expect(stale.querySelector('.shipment-attention')?.textContent).toContain(
      'Información sin actualizar',
    )
    const planned = rows().find((row) => row.textContent?.includes('ATL-ES-501'))!
    expect(planned.textContent).toContain('Estimación')
  })

  it('distingue sin resultados de filtros y permite quitarlos', () => {
    render(allViews, 'operations')
    changeValue(selectByLabel(view!.container, 'Progreso'), 'delivered')
    expect(rows().map((row) => row.querySelector('strong')?.textContent)).toEqual(['ATL-ES-001'])
    changeValue(view!.container.querySelector('input[type="search"]'), 'milán')
    expect(rows()).toHaveLength(0)
    expect(view!.container.textContent).toContain('Ningún envío coincide con los filtros')
    expect(view!.container.textContent).not.toContain('No hay envíos en tu perímetro')
    click(buttonByText(view!.container, 'Quitar filtros'))
    expect(rows()).toHaveLength(allViews.length)
  })

  it('muestra el perímetro vacío sin filtros', () => {
    render([], 'operations')
    expect(view!.container.textContent).toContain('No hay envíos en tu perímetro')
    expect(view!.container.querySelector('search')).toBeNull()
  })

  it('oculta selectores sin alternativa y el riesgo al cliente', () => {
    render([staleUnknown, delivered], 'customer')
    expect(selectByLabel(view!.container, 'Centro de origen')).toBeNull()
    expect(selectByLabel(view!.container, 'Riesgo')).toBeNull()
    expect(view!.container.querySelector('.shipment-attention')).toBeNull()
  })

  it('pagina un histórico grande y abre el detalle al pulsar una fila', () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      makeView({
        ...delivered,
        id: `shipment-${index}`,
        reference: `ATL-H-${String(index).padStart(3, '0')}`,
        account: delivered.account!,
        origin: delivered.origin!,
        destination: delivered.destination!,
        committedDeliveryAt: delivered.shipment.committedDeliveryAt,
        legs: [...delivered.shipment.legs],
        projection: delivered.projection,
      }),
    )
    const onSelect = render(many, 'operations')
    expect(rows()).toHaveLength(25)
    click(buttonByText(view!.container, 'Mostrar 5 más'))
    expect(rows()).toHaveLength(30)
    click(rows()[0])
    expect(onSelect).toHaveBeenCalledWith('shipment-0')
  })
})
