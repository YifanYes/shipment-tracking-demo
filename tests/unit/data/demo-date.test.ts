import { afterEach, describe, expect, it, vi } from 'vitest'
import { demoReferenceTime } from '@/data/scenarios/network'

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

const seedOn = async (now: string) => {
  vi.resetModules()
  vi.setSystemTime(new Date(now))
  const { buildDemoSeed } = await import('@/data/scenarios')
  return buildDemoSeed()
}

/** Replaces each timestamp with its distance to the clock start. */
const relative = (value: unknown, reference: number): unknown =>
  JSON.parse(
    JSON.stringify(value, (_key, item: unknown) =>
      typeof item === 'string' && ISO.test(item) ? Date.parse(item) - reference : item,
    ),
  )

describe('demo date', () => {
  afterEach(() => {
    vi.resetModules()
    vi.setSystemTime(new Date('2026-10-31T10:00:00.000Z'))
  })

  it.each([
    ['2026-11-05T18:40:00.000Z', '2026-11-05T10:00:00.000Z'],
    ['2026-07-15T08:00:00.000Z', '2026-07-15T09:00:00.000Z'],
    // 23:30 UTC is already the next day in Madrid.
    ['2026-12-31T23:30:00.000Z', '2027-01-01T10:00:00.000Z'],
    ['2026-03-29T00:30:00.000Z', '2026-03-29T09:00:00.000Z'],
    ['2026-10-25T12:00:00.000Z', '2026-10-25T10:00:00.000Z'],
  ])('starts at 11:00 in Madrid on the day of %s', (now, expected) => {
    expect(demoReferenceTime(new Date(now))).toBe(expected)
  })

  it('moves every date in the seed with the clock start', async () => {
    const base = await seedOn('2026-10-31T10:00:00.000Z')
    const moved = await seedOn('2027-02-14T16:00:00.000Z')

    expect(moved.dataset.referenceTime).toBe('2027-02-14T10:00:00.000Z')
    const shape = (seed: typeof base) => {
      const reference = Date.parse(seed.dataset.referenceTime)
      return relative({ dataset: seed.dataset, scenarios: seed.scenarios }, reference)
    }
    expect(shape(moved)).toEqual(shape(base))
  })

  it('writes story dates from the current clock start', async () => {
    const { steps } = await seedOn('2027-02-14T16:00:00.000Z')
    const detail = (id: string) => steps.find((step) => step.id === id)?.story?.detail

    expect(detail('sea-delay-notice')).toBe(
      'Nueva ETA: 16 feb, 07:00. Comprometida: 15 feb, 23:00.',
    )
    expect(detail('operator-reply')).toContain('18:30')
    expect(detail('customs-release')).toContain('17:00')
  })
})
