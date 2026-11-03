import { describe, expect, it } from 'vitest'
import { demoSeed } from '@/data/scenarios'
import { selectVisibleShipments } from '@/domain/selectors'
import { delayExplanation, timelineEntries } from '@/features/shipments/lib/presentation'
import { applyScheduledEvents } from '@/simulation/clock'

const view = selectVisibleShipments({
  dataset: demoSeed.dataset,
  identityId: 'operations-network',
  cutoffAt: demoSeed.dataset.referenceTime,
  selectedShipmentId: null,
}).find((item) => item.shipment.id === 'shipment-tr-004')!

describe('cronología multimodal', () => {
  it('explica en pasado lo resuelto de un envío entregado', () => {
    const end = new Date(
      Date.parse(demoSeed.dataset.referenceTime) +
        Math.max(...demoSeed.steps.map((step) => step.offsetMinutes)) * 60_000,
    ).toISOString()
    const final = selectVisibleShipments({
      dataset: applyScheduledEvents(demoSeed.dataset, demoSeed.scenarios, end),
      identityId: 'operations-network',
      cutoffAt: end,
      selectedShipmentId: null,
    }).find((item) => item.shipment.id === 'shipment-tr-004')!
    expect(final.projection.lifecycle).toBe('delivered')
    const reasons = delayExplanation(final)
    expect(reasons).toContain('Estuvo retenido en aduana.')
    expect(reasons).toContain('Falta documentación del envío.')
    expect(reasons).not.toContain('El envío está retenido en aduana.')
    expect(reasons).not.toContain('El operador informa de un retraso.')
  })

  it('no presenta como entrega el cierre de un tramo intermedio', () => {
    for (const audience of ['operations', 'customer'] as const) {
      const entries = timelineEntries(view, audience)
      const discharged = entries.find((entry) => entry.event.rawCode === 'DISCHARGED')!
      expect(discharged.title).toBe('Tramo completado')
      expect(discharged.delivered).toBe(false)
      expect(entries.some((entry) => entry.title === 'Entregado')).toBe(false)
    }
  })
})
