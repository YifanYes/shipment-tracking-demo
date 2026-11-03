import { ChartNoAxesCombined, LayoutDashboard, Truck } from 'lucide-react'
import type { DemoIdentity } from '@/domain/contracts'
import type { WorkspaceView } from '@/store/workspace-store'

type Role = DemoIdentity['role']

export const navigation = [
  {
    id: 'overview',
    label: 'Vista general',
    icon: LayoutDashboard,
    roles: ['operations', 'customer'],
  },
  { id: 'shipments', label: 'Envíos', icon: Truck, roles: ['operations', 'customer'] },
  { id: 'analytics', label: 'Análisis', icon: ChartNoAxesCombined, roles: ['operations'] },
] satisfies { id: WorkspaceView; label: string; icon: typeof Truck; roles: Role[] }[]

export type NavigationItem = (typeof navigation)[number]

export const navigationFor = (role: Role): NavigationItem[] =>
  navigation.filter((item) => (item.roles as readonly Role[]).includes(role))
