import { ChartNoAxesCombined, LayoutDashboard, Truck } from 'lucide-react'
import type { WorkspaceView } from '@/store/workspace-store'

export const navigation = [
  { id: 'overview', label: 'Vista general', icon: LayoutDashboard },
  { id: 'shipments', label: 'Envíos', icon: Truck },
  { id: 'analytics', label: 'Análisis', icon: ChartNoAxesCombined },
] satisfies { id: WorkspaceView; label: string; icon: typeof Truck }[]
