import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  MessagesSquare,
  Users,
  Contact,
  Workflow,
  Bot,
  CalendarDays,
  BarChart3,
  Plug,
  Building2,
  UsersRound,
  Bell,
  CreditCard,
  Settings,
} from "lucide-react"

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  badge?: number
}

export const operationNav: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Conversas", href: "/conversas", icon: MessagesSquare },
  { title: "Leads", href: "/leads", icon: Users },
  { title: "Clientes", href: "/clientes", icon: Contact },
  { title: "Automações", href: "/automacoes", icon: Workflow },
  { title: "Agentes IA", href: "/agentes", icon: Bot },
  { title: "Agenda", href: "/agenda", icon: CalendarDays },
  { title: "Analytics", href: "/analytics", icon: BarChart3 },
  { title: "Integrações", href: "/integracoes", icon: Plug },
]

export const companyNav: NavItem[] = [
  { title: "Empresa", href: "/empresa", icon: Building2 },
  { title: "Equipe", href: "/equipe", icon: UsersRound },
  { title: "Notificações", href: "/notificacoes", icon: Bell },
  { title: "Plano e Faturamento", href: "/plano", icon: CreditCard },
  { title: "Configurações", href: "/configuracoes", icon: Settings },
]
