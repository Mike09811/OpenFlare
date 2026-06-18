'use client';

import {useEffect, useState} from 'react';
import {ExternalLink, Loader2} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Progress} from '@/components/ui/progress';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {useOpenFlareServerUpgrade} from '@/lib/hooks/use-openflare-server-upgrade';
import type {LatestReleaseInfo, ReleaseChannel} from '@/lib/services/openflare';
import {formatDateTime} from '@/lib/utils';
import {formatRelativeTime} from '@/app/(main)/openflare/nodes/components/node-utils';

import {UpgradeLogPanel} from './upgrade-log-panel';

function getUpgradeBadge(release: LatestReleaseInfo | null | undefined) {
  if (!release) {
    return { label: '未检查', variant: 'outline' as const };
  }
  if (release.in_progress) {
    return { label: '升级中', variant: 'secondary' as const };
  }
  if (release.has_update) {
    return { label: '可升级', variant: 'secondary' as const };
  }
  return { label: '最新', variant: 'default' as const };
}

export function VersionUpgradeDialog({
  open,
  onOpenChange,
  canUpgrade = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canUpgrade?: boolean;
}) {
  const {
    currentVersion,
    selectedChannel,
    release,
    uploadedBinary,
    releaseErrorMessage,
    manualStatusMessage,
    manualErrorMessage,
    isInitialLoading,
    isChecking,
    isUpgrading,
    isUploadingBinary,
    uploadProgress,
    isConfirmingManualUpgrade,
    handleOpen,
    handleCheckRelease,
    handleChannelChange,
    handleUpgrade,
    handleUploadBinary,
    handleConfirmManualUpgrade,
  } = useOpenFlareServerUpgrade({ open, canUpgrade });
  const [selectedBinary, setSelectedBinary] = useState<File | null>(null);

  useEffect(() => {
    if (open) {
      handleOpen();
    }
  }, [open, handleOpen]);

  useEffect(() => {
    if (!open) {
      setSelectedBinary(null);
    }
  }, [open]);

  const upgradeBadge = getUpgradeBadge(release);
  const selectedChannelLabel = selectedChannel === 'preview' ? '预览版' : '正式版';
  const uploadPhaseLabel =
    uploadProgress >= 100 ? '已上传，正在服务端校验版本...' : '上传中...';
  const canConfirmManualUpgrade = Boolean(
    uploadedBinary?.ready_to_upgrade && uploadedBinary.upload_token,
  );

  const isBusy =
    isChecking || isUpgrading || isUploadingBinary || isConfirmingManualUpgrade;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>服务端版本</DialogTitle>
          <DialogDescription>
            默认检查正式版更新；也可检查 preview 发布或手动上传二进制包。升级开始后服务会短暂重启。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-dashed shadow-none py-4 gap-3">
              <CardHeader className="px-4 pb-0">
                <CardTitle className="text-sm">当前版本</CardTitle>
              </CardHeader>
              <CardContent className="px-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{currentVersion}</p>
                  <Badge variant={upgradeBadge.variant}>{upgradeBadge.label}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-dashed shadow-none py-4 gap-3">
              <CardHeader className="px-4 pb-0">
                <CardTitle className="text-sm">最新版本</CardTitle>
              </CardHeader>
              <CardContent className="px-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{release?.tag_name || '未检查'}</p>
                  {canUpgrade ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={isBusy}
                      onClick={() =>
                        handleChannelChange(selectedChannel === 'preview' ? 'stable' : 'preview')
                      }
                    >
                      {selectedChannelLabel}
                    </Button>
                  ) : null}
                </div>
                {canUpgrade ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isBusy}
                    onClick={handleCheckRelease}
                  >
                    {isChecking ? '检查中...' : `检查${selectedChannelLabel}`}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {isInitialLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 mr-2 animate-spin" />
              加载版本信息...
            </div>
          ) : null}

          {!isInitialLoading && releaseErrorMessage ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {releaseErrorMessage}
            </div>
          ) : null}

          <Tabs defaultValue="online">
            <TabsList>
              <TabsTrigger value="online">在线升级</TabsTrigger>
              {canUpgrade ? <TabsTrigger value="manual">手动升级</TabsTrigger> : null}
              {release ? <TabsTrigger value="logs">升级日志</TabsTrigger> : null}
            </TabsList>

            <TabsContent value="online" className="space-y-4">
              {!isInitialLoading && !releaseErrorMessage && !release ? (
                <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  尚未检查{selectedChannelLabel}，点击「检查{selectedChannelLabel}」后展示 GitHub Release 信息。
                </div>
              ) : null}

              {release ? (
                <Card className="border-dashed shadow-none py-4 gap-3">
                  <CardHeader className="px-4 pb-0">
                    <CardTitle className="text-sm">
                      GitHub {selectedChannelLabel} · {release.tag_name}
                    </CardTitle>
                    <CardDescription>
                      {release.published_at
                        ? `发布时间：${formatRelativeTime(release.published_at)} · ${formatDateTime(release.published_at)}`
                        : '未提供发布时间'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={release.has_update ? 'secondary' : 'default'}>
                        {release.has_update ? '发现新版本' : '已经是最新版本'}
                      </Badge>
                      {release.prerelease ? (
                        <Badge variant="secondary">Preview 发布</Badge>
                      ) : (
                        <Badge variant="outline">正式发布</Badge>
                      )}
                      {!release.upgrade_supported ? (
                        <Badge variant="destructive">当前平台不支持自动升级</Badge>
                      ) : null}
                      {release.in_progress ? (
                        <Badge variant="secondary">升级任务执行中</Badge>
                      ) : null}
                    </div>

                    <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {release.body || '暂无更新说明'}
                      </ReactMarkdown>
                    </div>

                    {release.html_url ? (
                      <a
                        href={release.html_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center text-sm text-primary hover:underline"
                      >
                        查看发布详情
                        <ExternalLink className="size-3 ml-1" />
                      </a>
                    ) : null}

                    {canUpgrade ? (
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          disabled={
                            !release.has_update ||
                            release.in_progress ||
                            isUpgrading ||
                            !release.upgrade_supported ||
                            isUploadingBinary ||
                            isConfirmingManualUpgrade
                          }
                          onClick={handleUpgrade}
                        >
                          {isUpgrading || release.in_progress
                            ? '升级中...'
                            : selectedChannel === 'preview'
                              ? '升级预览版'
                              : '升级正式版'}
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>

            {canUpgrade ? (
              <TabsContent value="manual" className="space-y-4">
                <Card className="border-dashed shadow-none py-4 gap-3">
                  <CardHeader className="px-4 pb-0">
                    <CardTitle className="text-sm">手动升级</CardTitle>
                    <CardDescription>
                      支持上传已编译好的当前平台 Server 可执行文件。
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="server-binary">服务端二进制</Label>
                      <Input
                        id="server-binary"
                        type="file"
                        disabled={isUploadingBinary || isConfirmingManualUpgrade}
                        onChange={(event) => {
                          setSelectedBinary(event.target.files?.[0] ?? null);
                        }}
                      />
                    </div>

                    <div className="flex justify-end">
                      {canConfirmManualUpgrade ? (
                        <Button
                          type="button"
                          disabled={
                            !canConfirmManualUpgrade ||
                            isConfirmingManualUpgrade ||
                            isUploadingBinary ||
                            isUpgrading
                          }
                          onClick={handleConfirmManualUpgrade}
                        >
                          {isConfirmingManualUpgrade ? '升级中...' : '确认升级'}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          disabled={
                            !selectedBinary ||
                            isUploadingBinary ||
                            isConfirmingManualUpgrade
                          }
                          onClick={() => {
                            if (selectedBinary) {
                              handleUploadBinary(selectedBinary);
                            }
                          }}
                        >
                          {isUploadingBinary
                            ? uploadProgress >= 100
                              ? '服务端校验中...'
                              : '上传中...'
                            : '上传并检查'}
                        </Button>
                      )}
                    </div>

                    {isUploadingBinary ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{uploadPhaseLabel}</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <Progress value={uploadProgress} />
                      </div>
                    ) : null}

                    {manualErrorMessage ? (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                        {manualErrorMessage}
                      </div>
                    ) : null}

                    {!manualErrorMessage && manualStatusMessage ? (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
                        {manualStatusMessage}
                      </div>
                    ) : null}

                    {uploadedBinary ? (
                      <div className="space-y-4 rounded-lg border border-dashed p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={uploadedBinary.ready_to_upgrade ? 'secondary' : 'outline'}
                          >
                            {uploadedBinary.ready_to_upgrade
                              ? '可确认升级'
                              : uploadedBinary.has_update
                                ? '待确认'
                                : '不可升级'}
                          </Badge>
                          {!uploadedBinary.upgrade_supported ? (
                            <Badge variant="destructive">当前版本不支持手动升级</Badge>
                          ) : null}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 text-sm">
                          <InfoCell label="文件名" value={uploadedBinary.file_name} />
                          <InfoCell
                            label="上传时间"
                            value={
                              uploadedBinary.uploaded_at
                                ? formatDateTime(uploadedBinary.uploaded_at)
                                : '未知'
                            }
                          />
                          <InfoCell label="当前版本" value={uploadedBinary.current_version} />
                          <InfoCell label="上传版本" value={uploadedBinary.detected_version} />
                        </div>

                        <p className="text-sm text-muted-foreground">
                          {uploadedBinary.comparison_message}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                        尚未上传升级包
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            ) : null}

            {release ? (
              <TabsContent value="logs">
                <UpgradeLogPanel release={release} />
              </TabsContent>
            ) : null}
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoCell({label, value}: {label: string; value: string}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium break-all">{value}</p>
    </div>
  );
}

export type {ReleaseChannel};
