import { RotateCcw, SkipForward } from 'lucide-react'
import { formatTime } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import type { WorkspaceView } from '@/store/workspace-store'
import type { NavigationItem } from '../navigation'

interface Props {
  view: WorkspaceView
  collapsed: boolean
  items: readonly NavigationItem[]
  onNavigate: (view: NavigationItem['id']) => void
  demoControls: { nextEventAt: string | null; onAdvance: () => void; onReset: () => void } | null
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
            variant="outline"
            className="sidebar-demo-button"
            disabled={!demoControls.nextEventAt}
            onClick={demoControls.onAdvance}
            aria-label="Siguiente evento"
            title="Siguiente evento"
          >
            <SkipForward size={16} aria-hidden="true" />
            <span className="sidebar-action-label">
              Siguiente evento
              {demoControls.nextEventAt && <small>{formatTime(demoControls.nextEventAt)}</small>}
            </span>
          </Button>
          <Button
            variant="ghost"
            className="sidebar-demo-button"
            onClick={demoControls.onReset}
            aria-label="Reiniciar"
            title="Reiniciar"
          >
            <RotateCcw size={16} aria-hidden="true" />
            <span className="sidebar-action-label">Reiniciar</span>
          </Button>
        </fieldset>
      )}
    </aside>
  )
}
