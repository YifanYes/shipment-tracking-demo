import { describe, expect, it } from 'vitest'
import { arrivalsToday, attentionReasons } from '@/domain/attention'
import { selectSummary } from '@/domain/selectors'
import { cutoffAt, operationsShipment as item } from '@tests/support/fixtures'

describe('atención y llegadas', () => {
  it('mantiene el mismo criterio de atención en lista y contadores', () => {
    const stale = { ...item, projection: { ...item.projection, freshness: 'stale' as const } }
    expect(attentionReasons(stale, cutoffAt)).toContain('Información sin actualizar')
    expect(selectSummary([stale], cutoffAt).attention).toBe(1)
    const delayed = {
      ...item,
      projection: {
        ...item.projection,
        eta: {
          ...item.projection.eta,
          kind: 'operator' as const,
          arrivalAt: '2026-10-31T16:00:00Z',
          issuedAt: cutoffAt,
          operatorId: 'operator-iberia',
          evidence: [],
        },
      },
    }
    expect(attentionReasons(delayed, cutoffAt)).toContain('Llegada prevista fuera de plazo')
    expect(selectSummary([delayed], cutoffAt).attention).toBe(1)
    expect(attentionReasons(item, '2026-10-31T15:00:00Z')).toContain(
      'Entrega pendiente fuera de plazo',
    )
  })

  it('cuenta las llegadas de hoy en Madrid y excluye mañana, el pasado y las entregas', () => {
    const withEta = (arrivalAt: string) => ({
      ...item,
      projection: {
        ...item.projection,
        eta: {
          kind: 'operator' as const,
          arrivalAt,
          issuedAt: cutoffAt,
          operatorId: 'operator-iberia',
          evidence: [],
        },
      },
    })
    expect(
      arrivalsToday(
        [
          withEta('2026-10-31T22:30:00Z'),
          withEta('2026-10-31T23:30:00Z'),
          withEta('2026-10-31T08:00:00Z'),
        ],
        cutoffAt,
      ),
    ).toBe(1)
    expect(arrivalsToday([withEta('2026-11-01T00:15:00Z')], '2026-10-31T23:15:00Z')).toBe(1)
    expect(
      arrivalsToday(
        [{ ...item, projection: { ...item.projection, lifecycle: 'delivered' } }],
        cutoffAt,
      ),
    ).toBe(0)
  })
})
