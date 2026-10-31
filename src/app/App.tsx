import { lazy, Suspense } from 'react'
import {
  ArrowDownToLine,
  ArrowUpRight,
  Box,
  ChartNoAxesCombined,
  CircleHelp,
  LayoutDashboard,
  MapPin,
  Package,
  Route,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { SceneBoundary } from '@/scene/SceneBoundary'
import { useWorkspaceStore, type WorkspaceView } from '@/store/use-workspace-store'

const NetworkPreview = lazy(() => import('@/scene/NetworkPreview'))

const navigation = [
  { id: 'overview', label: 'Vista general', icon: LayoutDashboard },
  { id: 'shipments', label: 'Envíos', icon: Truck },
  { id: 'analytics', label: 'Análisis IA', icon: ChartNoAxesCombined },
] satisfies { id: WorkspaceView; label: string; icon: typeof Truck }[]

const pageCopy = {
  overview: {
    title: 'Tu operación, en perspectiva.',
    description: 'Una visión compartida de cada envío y su recorrido.',
  },
  shipments: {
    title: 'Cada envío, de principio a fin.',
    description: 'Seguimiento por centro, operador y destino.',
  },
  analytics: {
    title: 'Entiende dónde se detiene tu red.',
    description: 'Evidencias y propuestas para mejorar la operación.',
  },
}

export function App() {
  const view = useWorkspaceStore((state) => state.view)
  const setView = useWorkspaceStore((state) => state.setView)
  const copy = pageCopy[view]

  return (
    <div className="workspace">
      <a className="skip-link" href="#main-content">
        Saltar al contenido
      </a>
      <aside className="sidebar" aria-label="Menú principal">
        <div className="brand">
          <span className="brand-icon">
            <Box size={23} />
          </span>
          <span>
            atlas<span className="brand-dot">.</span>
          </span>
        </div>
        <div className="workspace-label">CONTROL LOGÍSTICO</div>
        <nav className="navigation" aria-label="Navegación">
          {navigation.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              variant="ghost"
              className={`nav-button ${view === id ? 'nav-button-active' : ''}`}
              aria-current={view === id ? 'page' : undefined}
              onClick={() => setView(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </Button>
          ))}
        </nav>
        <div className="sidebar-note">
          <ShieldCheck size={18} />
          <p>
            Cada dato cuenta.
            <br />
            <span>Visibilidad con evidencia.</span>
          </p>
        </div>
        <Separator />
        <div className="sidebar-footer">
          <CircleHelp size={16} />
          <span>Espacio de demostración</span>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Espacio de trabajo <span>/</span>{' '}
            <strong>{navigation.find((item) => item.id === view)?.label}</strong>
          </div>
          <div className="identity">
            <span className="identity-avatar">OP</span>
            <div>
              <strong>Operaciones</strong>
              <span>Vista interna</span>
            </div>
          </div>
        </header>

        <main id="main-content" className="main-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <p className="eyebrow">RED DE TRANSPORTE</p>
              <h1>{copy.title}</h1>
              <p className="page-description">{copy.description}</p>
            </div>
            <Badge variant="outline" className="data-badge">
              <span />
              Sin datos cargados
            </Badge>
          </div>

          {view === 'overview' && (
            <>
              <section className="metric-grid" aria-label="Resumen de la operación">
                {[
                  { label: 'Envíos activos', icon: Package, detail: 'En todos tus centros' },
                  { label: 'Necesitan atención', icon: Route, detail: 'Incidencias por revisar' },
                  {
                    label: 'Próximas entregas',
                    icon: ArrowDownToLine,
                    detail: 'Según la información disponible',
                  },
                ].map(({ label, icon: Icon, detail }) => (
                  <Card key={label} className="metric-card">
                    <CardContent>
                      <div className="metric-label">
                        <span>{label}</span>
                        <Icon size={17} />
                      </div>
                      <div className="metric-value">0</div>
                      <p>{detail}</p>
                    </CardContent>
                  </Card>
                ))}
              </section>

              <div className="overview-grid">
                <section className="network-panel" aria-labelledby="network-title">
                  <div className="panel-heading">
                    <div>
                      <h2 id="network-title">Tu red logística</h2>
                      <p>Orígenes, conexiones y destinos</p>
                    </div>
                    <span className="scene-label">
                      <MapPin size={13} />
                      Vista isométrica
                    </span>
                  </div>
                  <figure
                    className="network-scene"
                    aria-label="Vista 3D inicial de un centro logístico"
                  >
                    <SceneBoundary>
                      <Suspense fallback={<p className="scene-fallback">Cargando vista de red…</p>}>
                        <NetworkPreview />
                      </Suspense>
                    </SceneBoundary>
                  </figure>
                  <div className="network-footer">
                    <span className="legend-dot" />
                    Centro de origen
                    <span className="network-footer-note">Recorrido esquemático</span>
                  </div>
                </section>

                <section className="attention-panel" aria-labelledby="attention-title">
                  <div className="panel-heading">
                    <div>
                      <h2 id="attention-title">Necesita tu atención</h2>
                      <p>Lo que conviene revisar primero</p>
                    </div>
                  </div>
                  <div className="empty-attention">
                    <div className="empty-icon">
                      <ShieldCheck size={28} />
                    </div>
                    <h3>Tu cartera empieza aquí</h3>
                    <p>Las incidencias aparecerán cuando haya envíos disponibles para revisar.</p>
                  </div>
                  <div className="assistant-note">
                    <Sparkles size={18} />
                    <p>Las recomendaciones incluirán el motivo y los datos que las respaldan.</p>
                  </div>
                </section>
              </div>

              <section className="shipments-summary" aria-labelledby="shipments-title">
                <div>
                  <h2 id="shipments-title">Envíos recientes</h2>
                  <p>La actividad de tus centros, en un mismo lugar.</p>
                </div>
                <Button variant="outline" onClick={() => setView('shipments')}>
                  Ver envíos
                  <ArrowUpRight size={15} />
                </Button>
              </section>
            </>
          )}

          {view === 'shipments' && (
            <EmptyPage
              icon={Package}
              title="Todavía no hay envíos"
              description="Aquí podrás consultar el estado, los hitos y los documentos de tu cartera."
            />
          )}
          {view === 'analytics' && (
            <EmptyPage
              icon={ChartNoAxesCombined}
              title="El análisis empieza con tus datos"
              description="El histórico permitirá identificar esperas, comparar recorridos y proponer mejoras con evidencias."
            />
          )}
          <footer className="content-footer">Atlas · Visibilidad de principio a fin</footer>
        </main>
      </div>
    </div>
  )
}

function EmptyPage({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Package
  title: string
  description: string
}) {
  return (
    <section className="empty-page">
      <div className="empty-icon">
        <Icon size={30} />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  )
}
