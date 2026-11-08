import { vi } from 'vitest'

// The demo starts on the current date. Tests pin it so their expected dates stay stable.
vi.useFakeTimers({ now: new Date('2026-10-31T10:00:00.000Z'), toFake: ['Date'] })
