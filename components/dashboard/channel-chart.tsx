"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { demoLeads } from "@/lib/demo-data"

const chartConfig: ChartConfig = {
  valor: { label: "Leads", color: "var(--chart-1)" },
}

const channelData = Object.entries(
  demoLeads.reduce<Record<string, number>>((acc, lead) => {
    acc[lead.origem] = (acc[lead.origem] ?? 0) + 1
    return acc
  }, {})
).map(([canal, valor]) => ({ canal, valor }))

export function ChannelChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Leads por canal</CardTitle>
        <CardDescription>De onde vieram os leads recebidos</CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  )
}
