import { RotateCcw, SkipForward } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import type { WorkspaceView } from '@/store/workspace-store'
import { navigation } from '../navigation'

interface Props {
  view: WorkspaceView
  collapsed: boolean
  onNavigate: (view: (typeof navigation)[number]['id']) => void
  demoControls: { canAdvance: boolean; onAdvance: () => void; onReset: () => void } | null
}

export function Sidebar({ view, collapsed, onNavigate, demoControls }: Props) {
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
        {navigation.map(({ id, label, icon: Icon }) => (
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
            disabled={!demoControls.canAdvance}
            onClick={demoControls.onAdvance}
            aria-label="Confirmar entrega · +2 h"
            title="Confirmar entrega · +2 h"
          >
            <SkipForward size={16} aria-hidden="true" />
            <span className="sidebar-action-label">
              Confirmar entrega<small>+2 h</small>
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
