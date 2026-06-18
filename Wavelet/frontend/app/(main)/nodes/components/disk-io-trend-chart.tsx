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
import type {DiskIOTrendPoint} from '@/lib/services/openflare';

import {formatTrendHour} from '../../components/dashboard/dashboard-utils';
import {formatBytes} from './node-utils';

const chartConfig = {
  diskRead: {
    label: '磁盘读',
    color: 'hsl(var(--chart-3))',
  },
  diskWrite: {
    label: '磁盘写',
    color: 'hsl(var(--chart-5))',
  },
} satisfies ChartConfig;

export function DiskIOTrendChart({
  points,
  title = '24 小时磁盘 IO 趋势',
  description = '观察磁盘读写变化，辅助判断日志放大、缓存抖动或磁盘压力。',
}: {
  points: DiskIOTrendPoint[];
  title?: string;
  description?: string;
}) {
  const data = points.map((point) => ({
    hour: formatTrendHour(point.bucket_started_at),
    diskRead: point.disk_read_bytes,
    diskWrite: point.disk_write_bytes,
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
                <linearGradient id="nodeDiskReadFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-diskRead)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--color-diskRead)" stopOpacity={0.02} />
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
                tickFormatter={(value) => formatBytes(Number(value))}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <span className="font-mono tabular-nums">
                        {formatBytes(Number(value))}
                        <span className="ml-1 text-muted-foreground">
                          {name === 'diskRead' ? '读' : '写'}
                        </span>
                      </span>
                    )}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="diskRead"
                stroke="var(--color-diskRead)"
                fill="url(#nodeDiskReadFill)"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="diskWrite"
                stroke="var(--color-diskWrite)"
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