import { Search, X } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import {
  hasActiveFilters,
  type FilterOption,
  type ShipmentFilterOptions,
  type ShipmentFilters,
} from '../lib/filters'
import type { Audience } from '../lib/presentation'

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: readonly FilterOption[]
  onChange: (value: string) => void
}) {
  return (
    <label className="filter-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function ShipmentFilterBar({
  filters,
  options,
  audience,
  onChange,
  onClear,
}: {
  filters: ShipmentFilters
  options: ShipmentFilterOptions
  audience: Audience
  onChange: (filters: ShipmentFilters) => void
  onClear: () => void
}) {
  const set = <K extends keyof ShipmentFilters>(key: K, value: ShipmentFilters[K]) =>
    onChange({ ...filters, [key]: value })
  // A selector with a single option cannot narrow the list; keep it only while it is applied.
  const useful = (list: readonly FilterOption[], value: string) => list.length > 1 || value !== ''

  return (
    <search className="shipment-filters" aria-label="Filtros de envíos">
      <div className="filter-search">
        <Search size={15} aria-hidden="true" />
        <Input
          type="search"
          aria-label="Buscar envíos"
          placeholder="Referencia, cuenta o lugar"
          value={filters.query}
          onChange={(event) => set('query', event.target.value)}
        />
      </div>
      {useful(options.origins, filters.originSiteId) && (
        <FilterSelect
          label="Centro de origen"
          value={filters.originSiteId}
          options={options.origins}
          onChange={(value) => set('originSiteId', value)}
        />
      )}
      {useful(options.accounts, filters.accountId) && (
        <FilterSelect
          label="Cuenta"
          value={filters.accountId}
          options={options.accounts}
          onChange={(value) => set('accountId', value)}
        />
      )}
      {useful(options.operators, filters.operatorId) && (
        <FilterSelect
          label="Operador"
          value={filters.operatorId}
          options={options.operators}
          onChange={(value) => set('operatorId', value)}
        />
      )}
      {useful(options.modes, filters.mode) && (
        <FilterSelect
          label="Modo"
          value={filters.mode}
          options={options.modes}
          onChange={(value) => set('mode', value as ShipmentFilters['mode'])}
        />
      )}
      <label className="filter-field">
        <span>Progreso</span>
        <select
          value={filters.progress}
          onChange={(event) => set('progress', event.target.value as ShipmentFilters['progress'])}
        >
          <option value="">Todos</option>
          <option value="open">Sin entregar</option>
          <option value="planned">Planificados</option>
          <option value="active">En curso</option>
          <option value="delivered">Entregados</option>
          {options.stages.length > 0 && (
            <optgroup label="Etapa actual">
              {options.stages.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      {audience === 'operations' && (
        <label className="filter-field">
          <span>Riesgo</span>
          <select
            value={filters.risk}
            onChange={(event) => set('risk', event.target.value as ShipmentFilters['risk'])}
          >
            <option value="">Todos</option>
            <option value="attention">Necesitan atención</option>
            <option value="clear">Sin avisos</option>
          </select>
        </label>
      )}
      {hasActiveFilters(filters) && (
        <Button variant="ghost" size="sm" className="filter-clear" onClick={onClear}>
          <X size={14} aria-hidden="true" />
          Quitar filtros
        </Button>
      )}
    </search>
  )
}
