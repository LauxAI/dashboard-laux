"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Filter } from "lucide-react"

const chartConfig: ChartConfig = {
  valor: { label: "Leads", color: "var(--chart-1)" },
}

export type FunnelPoint = { etapa: string; valor: number }

export function FunnelChart({ data = [] }: { data?: FunnelPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Funil de conversão</CardTitle>
        <CardDescription>Do primeiro contato até o cliente fechado</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <Empty className="h-[280px]">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Filter />
              </EmptyMedia>
              <EmptyTitle>Sem dados ainda</EmptyTitle>
              <EmptyDescription>O funil de conversão aparece aqui conforme você recebe leads.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
            <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16 }}>
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
        )}
      </CardContent>
    </Card>
  )
}
