import { describe, expect, it } from 'vitest'
import { updateAge } from '@/shared/lib/format'
import { cutoffAt, operationsShipment as item } from '@tests/support/fixtures'

describe('formato de presentación', () => {
  it('describe la antigüedad de la última ubicación confirmada', () => {
    expect(updateAge(item.projection.lastConfirmedLocation?.confirmedAt, cutoffAt)).toBe(
      'Actualizado hace 1 min',
    )
    expect(updateAge(undefined, cutoffAt)).toBe('Sin ubicación confirmada')
  })
})
