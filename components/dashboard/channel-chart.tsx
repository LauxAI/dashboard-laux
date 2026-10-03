"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { BarChart3 } from "lucide-react"
import type { Lead } from "@/lib/data/queries"

const chartConfig: ChartConfig = {
  valor: { label: "Leads", color: "var(--chart-1)" },
}

export function ChannelChart({ leads = [] }: { leads?: Lead[] }) {
  const channelData = Object.entries(
    leads.reduce<Record<string, number>>((acc, lead) => {
      const key = lead.source || "Outro"
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {}),
  ).map(([canal, valor]) => ({ canal, valor }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leads por canal</CardTitle>
        <CardDescription>De onde vieram os leads recebidos</CardDescription>
      </CardHeader>
      <CardContent>
        {channelData.length === 0 ? (
          <Empty className="h-[240px]">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BarChart3 />
              </EmptyMedia>
              <EmptyTitle>Sem dados ainda</EmptyTitle>
              <EmptyDescription>A distribuição por canal aparece aqui conforme você recebe leads.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
            <BarChart data={channelData} layout="vertical" margin={{ left: 0, right: 16 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="canal"
                tickLine={false}
                axisLine={false}
                width={100}
                className="text-xs"
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="valor" fill="var(--color-valor)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
