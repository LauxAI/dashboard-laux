"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { demoFunnel } from "@/lib/demo-data"

const chartConfig: ChartConfig = {
  valor: { label: "Leads", color: "var(--chart-1)" },
}

export function FunnelChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Funil de conversão</CardTitle>
        <CardDescription>Do primeiro contato até o cliente fechado</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
          <BarChart data={demoFunnel} layout="vertical" margin={{ left: 0, right: 16 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="etapa"
              tickLine={false}
              axisLine={false}
              width={120}
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
