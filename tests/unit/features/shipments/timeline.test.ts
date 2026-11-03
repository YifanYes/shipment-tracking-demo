import { describe, expect, it } from 'vitest'
import { demoSeed } from '@/data/scenarios'
import { selectVisibleShipments } from '@/domain/selectors'
import { timelineEntries } from '@/features/shipments/lib/presentation'

const view = selectVisibleShipments({
  dataset: demoSeed.dataset,
  identityId: 'operations-network',
  cutoffAt: demoSeed.dataset.referenceTime,
  selectedShipmentId: null,
}).find((item) => item.shipment.id === 'shipment-tr-004')!

describe('cronología multimodal', () => {
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
