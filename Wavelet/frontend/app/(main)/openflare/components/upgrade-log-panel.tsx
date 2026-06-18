'use client';

import {Badge} from '@/components/ui/badge';
import type {LatestReleaseInfo} from '@/lib/services/openflare';

function formatLogTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '0000-00-00 00:00:00.000';
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  const second = `${date.getSeconds()}`.padStart(2, '0');
  const millisecond = `${date.getMilliseconds()}`.padStart(3, '0');

  return `${year}-${month}-${day} ${hour}:${minute}:${second}.${millisecond}`;
}

function formatLogLevel(level: string) {
  return (level || 'info').toUpperCase().padEnd(8, ' ');
}

function getUpgradeStatusBadge(release: LatestReleaseInfo) {
  if (release.upgrade_status === 'failed') {
    return { label: '升级失败', variant: 'destructive' as const };
  }
  if (release.upgrade_status === 'succeeded') {
    return { label: '准备重启', variant: 'default' as const };
  }
  if (release.in_progress) {
    return { label: '升级中', variant: 'secondary' as const };
  }
  return { label: '空闲', variant: 'outline' as const };
}

export function UpgradeLogPanel({release}: {release: LatestReleaseInfo}) {
  const statusBadge = getUpgradeStatusBadge(release);
  const upgradeLogs = release.upgrade_logs ?? [];

  if (upgradeLogs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        暂无升级日志
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
      <div className="max-h-72 overflow-y-auto rounded-lg border bg-slate-950 px-4 py-3">
        {upgradeLogs.map((log, index) => (
          <pre
            key={`${log.created_at}-${index}`}
            className="overflow-x-auto border-b border-white/10 py-2 font-mono text-[12px] leading-6 text-slate-200 last:border-b-0"
          >
            <span className="text-slate-400">{formatLogTimestamp(log.created_at)}</span>
            <span className="text-slate-500"> | </span>
            <span className="text-cyan-300">{formatLogLevel(log.level)}</span>
            <span className="text-slate-500"> | </span>
            <span className="break-all whitespace-pre-wrap text-slate-100">{log.message}</span>
          </pre>
        ))}
      </div>
    </div>
  );
}