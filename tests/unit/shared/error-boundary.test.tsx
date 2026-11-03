// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { ErrorBoundary } from '@/shared/ui/error-boundary'

function Broken(): never {
  throw new Error('fragmento no disponible')
}

it('sustituye solo la parte que falla', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const silence = vi.spyOn(console, 'error').mockImplementation(() => {})
  const container = document.createElement('div')
  const root = createRoot(container, { onCaughtError: () => {} })
  await act(async () =>
    root.render(
      <>
        <p>Listado</p>
        <ErrorBoundary fallback={<p>Mapa no disponible</p>}>
          <Broken />
        </ErrorBoundary>
      </>,
    ),
  )
  expect(container.textContent).toBe('ListadoMapa no disponible')
  await act(async () => root.unmount())
  silence.mockRestore()
})
