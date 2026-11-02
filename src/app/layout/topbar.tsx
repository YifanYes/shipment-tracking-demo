import { ChevronDown, PanelLeft, UserRound } from 'lucide-react'
import type { DemoIdentity } from '@/domain/contracts'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'

interface Props {
  title: string
  count: number | null
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  identities: readonly DemoIdentity[]
  identityId: string
  onIdentityChange: (id: string) => void
}

export function Topbar({
  title,
  count,
  sidebarCollapsed,
  onToggleSidebar,
  identities,
  identityId,
  onIdentityChange,
}: Props) {
  const toggleLabel = sidebarCollapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'
  return (
    <header className="topbar">
      <div className="topbar-start">
        <Button
          variant="ghost"
          size="icon"
          className="sidebar-toggle"
          onClick={onToggleSidebar}
          aria-label={toggleLabel}
          title={toggleLabel}
          aria-expanded={!sidebarCollapsed}
          aria-controls="workspace-navigation"
        >
          <PanelLeft size={17} />
        </Button>
        <div className="page-identity">
          <h1 id="page-title" className="page-title">
            {title}
          </h1>
          {count !== null && (
            <Badge variant="secondary" className="page-count" aria-label={`${count} envíos`}>
              {count}
            </Badge>
          )}
        </div>
      </div>
      <div className="topbar-end">
        <label className="identity-picker">
          <UserRound size={16} aria-hidden="true" />
          <select
            aria-label="Identidad"
            value={identityId}
            onChange={(event) => onIdentityChange(event.target.value)}
          >
            {identities.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
          <ChevronDown className="identity-chevron" size={14} aria-hidden="true" />
        </label>
      </div>
    </header>
  )
}
