import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/app'
import { syncWorkspaceWithLocation } from '@/app/use-workspace-navigation'
import { Button } from '@/shared/ui/button'
import { ErrorBoundary } from '@/shared/ui/error-boundary'
import '@/styles/globals.css'

const container = document.getElementById('root')

if (!container) throw new Error('Falta el contenedor principal de la aplicación')

syncWorkspaceWithLocation()

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary
      fallback={
        <main className="app-error">
          <h1>No se pudo mostrar Atlas</h1>
          <Button onClick={() => window.location.reload()}>Recargar</Button>
        </main>
      }
    >
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
