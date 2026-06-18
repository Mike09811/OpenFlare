'use client';

import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {usePathname} from 'next/navigation';

import {VersionUpgradeDialog} from '@/app/(main)/openflare/components/version-upgrade-dialog';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {useUser} from '@/contexts/user-context';
import {
  openflareLatestReleaseQueryKey,
  openflarePublicStatusQueryKey,
} from '@/lib/hooks/use-openflare-server-upgrade';
import {StatusService, UpdateService} from '@/lib/services/openflare';

export function OpenFlareVersionEntry() {
  const pathname = usePathname();
  const {user} = useUser();
  const [dialogOpen, setDialogOpen] = useState(false);

  const isOpenFlareRoute = pathname.startsWith('/openflare');
  const canUpgrade = Boolean(user?.is_admin);

  const statusQuery = useQuery({
    queryKey: openflarePublicStatusQueryKey,
    queryFn: () => StatusService.getPublicStatus(),
    enabled: isOpenFlareRoute,
    staleTime: 60_000,
  });

  const releaseQuery = useQuery({
    queryKey: openflareLatestReleaseQueryKey('stable'),
    queryFn: () => UpdateService.getLatestRelease('stable'),
    enabled: isOpenFlareRoute && canUpgrade,
    staleTime: 60 * 60 * 1000,
  });

  if (!isOpenFlareRoute) {
    return null;
  }

  const version = statusQuery.data?.version || releaseQuery.data?.current_version || 'unknown';
  const hasUpdate = Boolean(canUpgrade && releaseQuery.data?.has_update);
  const versionLabel = hasUpdate ? `OpenFlare ${version} · 可升级` : `OpenFlare ${version}`;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="hidden h-8 gap-2 px-2.5 text-xs md:inline-flex"
        onClick={() => setDialogOpen(true)}
      >
        <span className="max-w-[180px] truncate">{versionLabel}</span>
        {hasUpdate ? <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">新</Badge> : null}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 md:hidden"
        onClick={() => setDialogOpen(true)}
        aria-label="服务端版本"
      >
        <Badge
          variant={hasUpdate ? 'secondary' : 'outline'}
          className="h-6 px-2 text-[10px] font-medium"
        >
          版本
        </Badge>
      </Button>

      <VersionUpgradeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        canUpgrade={canUpgrade}
      />
    </>
  );
}