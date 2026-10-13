"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { fmtDay } from "@/lib/format"
import type { SessionPoint } from "@/lib/types"

const config = {
  present: { label: "Presente", color: "var(--status-present)" },
  late: { label: "Tarde", color: "var(--status-late)" },
  excused: { label: "Justificado", color: "var(--status-excused)" },
  absent: { label: "Falta", color: "var(--status-absent)" },
} satisfies ChartConfig

const KEYS = ["present", "late", "excused", "absent"] as const

/** Barras apiladas: distribución de estados en cada sesión dictada. */
export function AttendanceChart({ data }: { data: SessionPoint[] }) {
  return (
    <ChartContainer config={config} className="aspect-auto h-[280px] w-full">
      <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barCategoryGap="22%">
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          fontSize={11}
        />
        <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} width={44} />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.6 }}
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const p = payload?.[0]?.payload as SessionPoint | undefined
                return p ? `${fmtDay(p.session_date)} · ${p.rate}% asistencia` : ""
              }}
            />
          }
        />
        <ChartLegend
          content={<ChartLegendContent />}
          itemSorter={(item) => KEYS.indexOf(item.dataKey as (typeof KEYS)[number])}
        />
        {KEYS.map((k, i) => (
          <Bar
            key={k}
            dataKey={k}
            stackId="a"
            fill={`var(--color-${k})`}
            stroke="var(--card)"
            strokeWidth={2}
            radius={i === KEYS.length - 1 ? [4, 4, 0, 0] : i === 0 ? [0, 0, 4, 4] : 0}
            maxBarSize={36}
          />
        ))}
      </BarChart>
    </ChartContainer>
  )
}
