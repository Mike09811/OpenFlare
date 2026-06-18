'use client';

import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { CapacityTrendPoint } from '@/lib/services/openflare';

import { formatPercent, formatTrendHour } from './dashboard-utils';

const chartConfig = {
  cpu: {
    label: '平均 CPU',
    color: 'hsl(var(--chart-2))',
  },
  memory: {
    label: '平均内存',
    color: 'hsl(var(--chart-3))',
  },
} satisfies ChartConfig;

export function CapacityTrendChart({
  points,
  title = '24 小时容量趋势',
  description = '按小时聚合 CPU 与内存使用率，判断整体容量是否持续紧张。',
}: {
  points: CapacityTrendPoint[];
  title?: string;
  description?: string;
}) {
  const data = points.map((point) => ({
    hour: formatTrendHour(point.bucket_started_at),
    cpu: point.average_cpu_usage_percent,
    memory: point.average_memory_usage_percent,
  }));

  if (data.length === 0) {
    return (
      <Card className="border-dashed shadow-none">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          <CardDescription className="text-xs">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[280px] items-center justify-center text-xs text-muted-foreground">
            暂无趋势数据
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed shadow-none">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="pl-2 pr-4">
        <div className="h-[280px] w-full">
          <ChartContainer config={chartConfig} className="h-full w-full">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="capacityCpuFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-cpu)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--color-cpu)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="hour"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                domain={[0, 100]}
                tickFormatter={(value) => formatPercent(Number(value))}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <span className="font-mono tabular-nums">
                        {formatPercent(Number(value))}
                        <span className="ml-1 text-muted-foreground">
                          {name === 'cpu' ? 'CPU' : '内存'}
                        </span>
                      </span>
                    )}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="cpu"
                stroke="var(--color-cpu)"
                fill="url(#capacityCpuFill)"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="memory"
                stroke="var(--color-memory)"
                strokeWidth={2}
                dot={false}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}