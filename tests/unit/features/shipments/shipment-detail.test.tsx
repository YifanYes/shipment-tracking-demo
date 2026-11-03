// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShipmentDetail } from '@/features/shipments'
import type { ShipmentView } from '@/domain/contracts'
import {
  buttonByText,
  click,
  customsDocumentProvided,
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

const render = (item: ShipmentView, audience: 'operations' | 'customer') => {
  const mounted = renderView(ShipmentDetail, {
    item,
    cutoffAt: viewCutoffAt,
    audience,
    onBack: vi.fn(),
  })
  view = mounted
  return mounted.container
}

describe('detalle del envío', () => {
  it('muestra a operaciones el código original, la recepción tardía y la clasificación pendiente', () => {
    const container = render(staleUnknown, 'operations')
    const events = [...container.querySelectorAll('.event-list li')]
    expect(events).toHaveLength(2)
    expect(events[0]?.textContent).toContain('ZX_TEMP_99')
    expect(events[0]?.textContent).toContain('Pendiente de clasificación')
    expect(events[0]?.textContent).toContain('4 h después')
    expect(events[1]?.textContent).toContain('PICKED_UP')
    expect(document.activeElement?.id).toBe('detail-title')
  })

  it('oculta al cliente códigos internos y eventos sin clasificar', () => {
    const container = render(staleUnknown, 'customer')
    expect(container.textContent).not.toContain('ZX_TEMP_99')
    expect(container.textContent).not.toContain('PICKED_UP')
    expect(container.textContent).not.toContain('Pendiente de clasificación')
    expect(container.querySelectorAll('.event-list li')).toHaveLength(1)
    expect(container.querySelector('.event-list')?.textContent).toContain('recogido')
  })

  it('indica información insuficiente sin ETA y la fecha comprometida superada', () => {
    const facts = render(staleUnknown, 'operations').querySelector('.detail-facts')!
    expect(facts.textContent).toContain('Sin previsión')
    expect(facts.textContent).toContain('Sin ETA del operador en las últimas 24 h.')
    expect(facts.textContent).toContain('Fecha comprometida superada hace 2 h')
  })

  it('separa la estimación con sus supuestos', () => {
    const facts = render(plannedEstimate, 'operations').querySelector('.detail-facts')!
    expect(facts.textContent).toContain('Estimación')
    expect(facts.textContent).toContain('Recogida según el plan')
  })

  it('recorre tramos multimodales con su hito confirmado y el retraso de la ETA', () => {
    const container = render(seaDelayed, 'operations')
    const legs = [...container.querySelectorAll('.journey-leg')]
    expect(legs.map((leg) => leg.getAttribute('data-state'))).toEqual([
      'done',
      'current',
      'pending',
    ])
    expect(legs[1]?.textContent).toContain('Puerto de Valencia → Puerto de Génova')
    expect(
      legs[1]?.querySelector('.milestone-list [aria-current="step"] strong')?.textContent,
    ).toBe('En tránsito')
    expect(container.querySelector('.detail-facts')?.textContent).toContain(
      '30 h después de lo comprometido',
    )
  })

  it('mantiene la retención aduanera aunque el documento ya esté disponible', () => {
    const container = render(customsDocumentProvided, 'customer')
    expect(container.querySelector('.detail-status')?.textContent).toContain('Retenido en aduana')
    const link = container.querySelector<HTMLAnchorElement>('.document-item a')!
    expect(link.getAttribute('href')).toBe('/documents/dua.pdf')
    expect(link.target).toBe('_blank')
    const incidents = [...container.querySelectorAll('.incident-card')]
    expect(incidents[0]?.getAttribute('data-condition')).toBe('active')
    expect(incidents[0]?.textContent).toContain('La retención sigue activa')
    expect(incidents[1]?.getAttribute('data-condition')).toBe('cleared')
  })

  it('marca el documento ausente y enlaza la evidencia con el documento', () => {
    const container = render(customsHold, 'operations')
    const documentItem = container.querySelector('.document-item')!
    expect(documentItem.textContent).toContain('Pendiente de recibir')
    expect(documentItem.querySelector('a')).toBeNull()
    expect(container.querySelector('.incident-note')).toBeNull()
    click(buttonByText(container, 'DUA de importación'))
    expect(document.activeElement).toBe(documentItem)
  })

  it('muestra la entrega confirmada dentro de plazo', () => {
    const container = render(delivered, 'operations')
    expect(container.querySelector('.detail-status')?.textContent).toContain('Entregado')
    expect(container.querySelector('.detail-facts')?.textContent).toContain('Dentro de plazo')
    expect(container.querySelector('.incidents-panel')).toBeNull()
  })
})
