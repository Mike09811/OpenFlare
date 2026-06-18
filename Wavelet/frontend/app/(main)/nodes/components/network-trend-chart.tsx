'use client';

import {Area, AreaChart, CartesianGrid, Line, XAxis, YAxis} from 'recharts';

import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type {NetworkTrendPoint} from '@/lib/services/openflare';

import {formatTrendHour} from '../../components/dashboard/dashboard-utils';
import {formatBytesPerSecond} from './node-utils';

const chartConfig = {
  openrestyRx: {
    label: 'OpenResty 入站',
    color: 'hsl(var(--chart-2))',
  },
  openrestyTx: {
    label: 'OpenResty 出站',
    color: 'hsl(var(--chart-4))',
  },
} satisfies ChartConfig;

export function NetworkTrendChart({
  points,
  title = '24 小时网络趋势',
  description = '观察 OpenResty 入站/出站吞吐的变化，辅助识别回源压力、突发流量或出口异常。',
}: {
  points: NetworkTrendPoint[];
  title?: string;
  description?: string;
}) {
  const data = points.map((point) => ({
    hour: formatTrendHour(point.bucket_started_at),
    openrestyRx: point.openresty_rx_bytes,
    openrestyTx: point.openresty_tx_bytes,
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
                <linearGradient id="nodeOpenrestyRxFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-openrestyRx)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--color-openrestyRx)" stopOpacity={0.02} />
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
                tickFormatter={(value) => formatBytesPerSecond(Number(value), 3600)}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <span className="font-mono tabular-nums">
                        {formatBytesPerSecond(Number(value), 3600)}
                        <span className="ml-1 text-muted-foreground">
                          {name === 'openrestyRx' ? '入站' : '出站'}
                        </span>
                      </span>
                    )}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="openrestyRx"
                stroke="var(--color-openrestyRx)"
                fill="url(#nodeOpenrestyRxFill)"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="openrestyTx"
                stroke="var(--color-openrestyTx)"
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