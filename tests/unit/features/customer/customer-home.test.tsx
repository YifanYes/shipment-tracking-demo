// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CustomerHome } from '@/features/customer'
import type { ShipmentView } from '@/domain/contracts'
import {
  buttonByText,
  click,
  customsHold,
  delivered,
  plannedEstimate,
  renderView,
  type MountedView,
  seaDelayed,
  staleUnknown,
  viewCutoffAt,
} from '@tests/support/view-fixtures'

let view: MountedView | undefined
afterEach(() => view?.unmount())

const render = (shipments: readonly ShipmentView[]) => {
  const onOpenShipment = vi.fn()
  view = renderView(CustomerHome, { shipments, cutoffAt: viewCutoffAt, onOpenShipment })
  return { container: view.container, onOpenShipment }
}

describe('inicio del cliente', () => {
  it('avisa de un posible retraso como estimación, sin que operaciones intervenga', () => {
    const slowed = {
      ...plannedEstimate,
      projection: {
        ...plannedEstimate.projection,
        lifecycle: 'active' as const,
        eta: {
          kind: 'estimate' as const,
          earliestAt: viewCutoffAt,
          latestAt: new Date(
            Date.parse(plannedEstimate.shipment.committedDeliveryAt) + 3_600_000,
          ).toISOString(),
          issuedAt: viewCutoffAt,
          assumptions: [],
          evidence: [],
        },
      },
    }
    const { container } = render([slowed])
    const notice = container.querySelector('.customer-notice[data-kind="estimate"]')
    expect(notice?.textContent).toContain('Estimación IA')
    expect(notice?.textContent).toContain(`Posible retraso de ${slowed.shipment.reference}`)
    expect(notice?.textContent).toContain('Sin confirmar por el operador.')
  })

  it('ordena las próximas entregas por llegada prevista y deja al final las que no tienen ETA', () => {
    const { container } = render([staleUnknown, seaDelayed, plannedEstimate, delivered])
    const upcoming = [...container.querySelectorAll('.customer-cards h3')].map((h) => h.textContent)
    expect(upcoming).toEqual(['ATL-ES-501', 'ATL-IT-201', 'ATL-ES-401'])
    expect(container.querySelector('.customer-recent')?.textContent).toContain('ATL-ES-001')
    expect(container.querySelector('.customer-recent')?.textContent).toContain('Dentro de plazo')
  })

  it('explica el retraso frente a la fecha comprometida con sus incidencias', () => {
    const { container } = render([seaDelayed])
    const card = container.querySelector('.customer-card')!
    expect(card.getAttribute('data-late')).toBe('true')
    expect(card.textContent).toContain('Retraso previsto de 30 h')
    expect(card.textContent).toContain('El operador informa de un retraso.')
  })

  it('da acceso a documentos disponibles, marca los pendientes y abre el detalle', () => {
    const { container, onOpenShipment } = render([customsHold, delivered])
    const held = container.querySelector('.customer-card')!
    expect(held.textContent).toContain('Retenido en aduana')
    expect(held.textContent).toContain('DUA de importación · Pendiente de recibir')
    const link = container.querySelector<HTMLAnchorElement>('.customer-recent a')!
    expect(link.getAttribute('href')).toBe('/documents/albaran-atl-es-001.pdf')
    expect(container.textContent).not.toContain('CUS_HOLD')
    click(buttonByText(container, 'Ver detalle'))
    expect(onOpenShipment).toHaveBeenCalledWith('shipment-customs')
  })

  it('muestra una cuenta sin envíos', () => {
    const { container } = render([])
    expect(container.textContent).toContain('No hay envíos para esta cuenta')
  })
})
