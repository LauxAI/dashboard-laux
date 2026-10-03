"use client"

import { useRouter } from "next/navigation"
import { Bell, LogOut, Search, Settings, User } from "lucide-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase/client"

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

type HeaderNotification = {
  id: string
  title: string
  message: string | null
  read: boolean
  created_at: string
}

export function AppHeader({
  user,
  notifications = [],
}: {
  user: { name: string; email: string }
  notifications?: HeaderNotification[]
}) {
  const router = useRouter()
  const unreadCount = notifications.filter((n) => !n.read).length

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-5" />
      <InputGroup className="hidden max-w-sm md:flex">
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput placeholder="Buscar leads, conversas, clientes..." />
      </InputGroup>
      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative" />}>
            <Bell />
            {unreadCount > 0 && (
              <Badge
                variant="default"
                className="absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]"
              >
                {unreadCount}
              </Badge>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notificações</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length > 0 ? (
              <DropdownMenuGroup>
                {notifications.slice(0, 5).map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    onClick={() => router.push("/notificacoes")}
                    className="flex flex-col items-start gap-0.5 whitespace-normal"
                  >
                    <div className="flex w-full items-center gap-2">
                      {!notification.read && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                      <span className="text-sm font-medium text-foreground">{notification.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{notification.message}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            ) : (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                Nenhuma notificação por aqui.
              </p>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/notificacoes")} className="justify-center text-sm">
              Ver todas as notificações
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" className="gap-2 px-1.5" />}>
            <Avatar className="size-7">
              <AvatarFallback className="bg-primary/15 text-xs text-primary">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium sm:inline">{user.name}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">{user.name}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push("/empresa")}>
                <User />
                Minha conta
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/configuracoes")}>
                <Settings />
                Configurações
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
