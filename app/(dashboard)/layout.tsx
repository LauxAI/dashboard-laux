import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { AppHeader } from "@/components/layout/app-header"
import { createClient } from "@/lib/supabase/server"
import { ADMIN_ACCOUNT_REASON, getAccountAccess, INACTIVE_ACCOUNT_REASON } from "@/lib/supabase/account-access"
import { getCompany, getNotifications } from "@/lib/data/queries"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: userData, error } = await supabase.auth.getUser()

  if (error || !userData?.user) {
    redirect("/login")
  }

  // Defense in depth: the proxy already signs blocked users out, but no
  // protected page may render without an active client account.
  const access = await getAccountAccess(supabase)
  if (access.status !== "active") {
    redirect(`/login?motivo=${access.status === "admin" ? ADMIN_ACCOUNT_REASON : INACTIVE_ACCOUNT_REASON}`)
  }

  const [company, { data: profile }, notifications] = await Promise.all([
    getCompany(),
    supabase.from("profiles").select("full_name, email").eq("id", userData.user.id).maybeSingle(),
    getNotifications(),
  ])

  const user = {
    name: profile?.full_name || userData.user.email?.split("@")[0] || "Usuário",
    email: profile?.email || userData.user.email || "",
  }

  return (
    <SidebarProvider>
      <AppSidebar companyName={company?.name ?? "Minha Empresa"} userName={user.name} userEmail={user.email} />
      <SidebarInset>
        <AppHeader user={user} notifications={notifications.data} />
        <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
