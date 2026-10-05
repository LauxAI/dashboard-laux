"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Appointment } from "@/lib/domain/types"
import { AppointmentsOverview } from "./appointments-overview"
import { AvailabilitySettings } from "./availability-settings"

export function AgendaTabs({ appointments }: { appointments: Appointment[] }) {
  return (
    <Tabs defaultValue="agendamentos" className="gap-6">
      <TabsList variant="line" className="border-b">
        <TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
        <TabsTrigger value="disponibilidade">Disponibilidade</TabsTrigger>
      </TabsList>
      <TabsContent value="agendamentos">
        <AppointmentsOverview appointments={appointments} />
      </TabsContent>
      <TabsContent value="disponibilidade">
        <AvailabilitySettings />
      </TabsContent>
    </Tabs>
  )
}
