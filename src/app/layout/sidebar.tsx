import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react'
import { formatTime } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import type { WorkspaceView } from '@/store/workspace-store'
import type { NavigationItem } from '../navigation'

interface Props {
  view: WorkspaceView
  collapsed: boolean
  items: readonly NavigationItem[]
  onNavigate: (view: NavigationItem['id']) => void
  demoControls: {
    nextStep: { label: string; at: string } | null
    playing: boolean
    onTogglePlay: () => void
    onAdvance: () => void
    onReset: () => void
  } | null
}

export function Sidebar({ view, collapsed, items, onNavigate, demoControls }: Props) {
  return (
    <aside className="sidebar" aria-label="Menú principal" data-collapsed={collapsed}>
      <div className="sidebar-header">
        <div className="brand">
          <img className="brand-mark" src="/atlas-mark.svg" alt="" width="36" height="36" />
          <span className="brand-wordmark">Atlas</span>
        </div>
      </div>
      <div className="workspace-label">CONTROL LOGÍSTICO</div>
      <nav id="workspace-navigation" className="navigation" aria-label="Navegación">
        {items.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant="ghost"
            className={`nav-button ${view === id || (id === 'shipments' && view === 'shipment-detail') ? 'nav-button-active' : ''}`}
            aria-current={
              view === id
                ? 'page'
                : id === 'shipments' && view === 'shipment-detail'
                  ? 'location'
                  : undefined
            }
            aria-label={label}
            title={collapsed ? label : undefined}
            onClick={() => onNavigate(id)}
          >
            <Icon size={18} />
            <span className="nav-label">{label}</span>
          </Button>
        ))}
      </nav>
      {demoControls && (
        <fieldset className="sidebar-footer" aria-label="Controles de demo">
          <Button
            variant="ghost"
            className="sidebar-demo-button"
            disabled={!demoControls.nextStep}
            onClick={demoControls.onTogglePlay}
            aria-label={demoControls.playing ? 'Pausar' : 'Reproducir'}
            title={collapsed ? (demoControls.playing ? 'Pausar' : 'Reproducir') : undefined}
          >
            {demoControls.playing ? (
              <Pause size={16} aria-hidden="true" />
            ) : (
              <Play size={16} aria-hidden="true" />
            )}
            <span className="sidebar-action-label">
              {demoControls.playing ? 'Pausar' : 'Reproducir'}
            </span>
          </Button>
          <Button
            variant="outline"
            className="sidebar-demo-button"
            disabled={!demoControls.nextStep}
            onClick={demoControls.onAdvance}
            aria-label={
              demoControls.nextStep
                ? `Siguiente paso: ${demoControls.nextStep.label}`
                : 'Demo completada'
            }
            title={collapsed ? (demoControls.nextStep?.label ?? 'Demo completada') : undefined}
          >
            <SkipForward size={16} aria-hidden="true" />
            <span className="sidebar-action-label">
              {/* Non-breaking hyphens keep shipment references on one line. */}
              {demoControls.nextStep?.label.replace(/(\w)-(?=\w)/g, '$1\u2011') ??
                'Demo completada'}
              {demoControls.nextStep && <small>{formatTime(demoControls.nextStep.at)}</small>}
            </span>
          </Button>
          <Button
            variant="ghost"
            className="sidebar-demo-button"
            onClick={demoControls.onReset}
            aria-label="Reiniciar"
            title={collapsed ? 'Reiniciar' : undefined}
          >
            <RotateCcw size={16} aria-hidden="true" />
            <span className="sidebar-action-label">Reiniciar</span>
          </Button>
        </fieldset>
      )}
    </aside>
  )
}
