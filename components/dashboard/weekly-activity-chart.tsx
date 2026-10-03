"use client"

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { LineChart } from "lucide-react"

const chartConfig: ChartConfig = {
  conversas: { label: "Conversas", color: "var(--chart-1)" },
  leads: { label: "Leads", color: "var(--chart-2)" },
  conversoes: { label: "Conversões", color: "var(--chart-3)" },
}

export type WeeklyActivityPoint = {
  dia: string
  conversas: number
  leads: number
  conversoes: number
}

export function WeeklyActivityChart({ data = [] }: { data?: WeeklyActivityPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Atividade da semana</CardTitle>
        <CardDescription>Conversas, leads e conversões nos últimos 7 dias</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <Empty className="h-[280px]">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LineChart />
              </EmptyMedia>
              <EmptyTitle>Sem dados ainda</EmptyTitle>
              <EmptyDescription>A atividade da semana aparece aqui conforme você usa a plataforma.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
        <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
          <AreaChart data={data} margin={{ left: 0, right: 0 }}>
            <defs>
              <linearGradient id="fillConversas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-conversas)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-conversas)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="fillLeads" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-leads)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-leads)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="dia"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              className="text-xs"
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              dataKey="conversas"
              type="monotone"
              fill="url(#fillConversas)"
              stroke="var(--color-conversas)"
              strokeWidth={2}
            />
            <Area
              dataKey="leads"
              type="monotone"
              fill="url(#fillLeads)"
              stroke="var(--color-leads)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
