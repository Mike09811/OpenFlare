'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {ArrowLeft, FileText, RefreshCw, RotateCcw, Trash2, Upload,} from 'lucide-react';
import {toast} from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {formatDateTime} from '@/lib/utils';
import type {NodeAgentReleaseInfo, NodeItem, ReleaseChannel} from '@/lib/services/openflare';
import {NodeService} from '@/lib/services/openflare';

import {AgentUpdateDialog} from './agent-update-dialog';
import {InstallCommand} from './install-command';
import {NodeEditorDialog} from './node-editor-dialog';
import {NodeObservability} from './node-observability';
import {NodeStatusBadge} from './node-status-badge';
import {
  formatRelativeTime,
  getApplyLabel,
  getApplyTone,
  getErrorMessage,
  getFlaredStatusLabel,
  getFlaredStatusTone,
  getNodeStatusLabel,
  getNodeStatusTone,
  isMeaningfulTime,
  isWSConnectedLastSeen,
} from './node-utils';

const nodesQueryKey = ['openflare', 'nodes'];

export function TunnelNodeDetail({ node }: { node: NodeItem }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const saveMutation = useMutation({
    mutationFn: (payload: Parameters<typeof NodeService.updateNode>[1]) =>
      NodeService.updateNode(node.id, payload),
    onSuccess: async () => {
      toast.success('隧道节点已更新');
      setEditorOpen(false);
      await queryClient.invalidateQueries({ queryKey: nodesQueryKey });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const forceSyncMutation = useMutation({
    mutationFn: () => NodeService.requestForceSync(node.id),
    onSuccess: async (updated) => {
      toast.success(`已向隧道节点 ${updated.name} 下发强制同步指令`);
      await queryClient.invalidateQueries({ queryKey: nodesQueryKey });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const upgradeMutation = useMutation({
    mutationFn: ({
      release,
      channel,
    }: {
      release: NodeAgentReleaseInfo | null;
      channel: ReleaseChannel;
    }) =>
      NodeService.requestAgentUpdate(node.id, {
        channel: release?.channel ?? channel,
        tag_name: release?.channel === 'preview' ? release.tag_name || undefined : undefined,
      }),
    onSuccess: async (updated) => {
      toast.success(
        `已向隧道节点 ${updated.name} 下发${updated.update_channel === 'preview' ? '预览版' : '正式版'}升级指令`,
      );
      setUpgradeOpen(false);
      await queryClient.invalidateQueries({ queryKey: nodesQueryKey });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => NodeService.deleteNode(node.id),
    onSuccess: async () => {
      toast.success('隧道节点已删除');
      await queryClient.invalidateQueries({ queryKey: nodesQueryKey });
      router.push('/nodes');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const handleRefresh = () => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: nodesQueryKey }),
      queryClient.invalidateQueries({ queryKey: ['openflare', 'node-observability', node.id] }),
    ]);
  };

  return (
    <div className="py-6 px-1 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
            <Link href="/nodes">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{node.name}</h1>
          <NodeStatusBadge
            label={getNodeStatusLabel(node.status)}
            tone={getNodeStatusTone(node.status)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditorOpen(true)}>
            编辑
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleRefresh}>
            <RefreshCw className="size-3.5 mr-1" />
            刷新
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={forceSyncMutation.isPending}
            onClick={() => forceSyncMutation.mutate()}
          >
            <RotateCcw className="size-3.5 mr-1" />
            {forceSyncMutation.isPending ? '同步中...' : '强制同步'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setUpgradeOpen(true)}
          >
            <Upload className="size-3.5 mr-1" />
            {node.update_requested ? '查看升级' : '升级 openflared'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-3.5 mr-1" />
            删除
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-dashed shadow-none">
          <CardHeader className="pb-2">
            <CardDescription>节点 ID</CardDescription>
            <CardTitle className="text-sm font-medium break-all">{node.node_id}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-dashed shadow-none">
          <CardHeader className="pb-2">
            <CardDescription>openflared 版本</CardDescription>
            <CardTitle className="text-sm font-medium">{node.version || 'unknown'}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-dashed shadow-none">
          <CardHeader className="pb-2">
            <CardDescription>当前配置版本</CardDescription>
            <CardTitle className="text-sm font-medium">{node.current_version || '未应用'}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-dashed shadow-none">
          <CardHeader className="pb-2">
            <CardDescription>最近心跳</CardDescription>
            <CardTitle className="text-sm font-medium">
              {isWSConnectedLastSeen(node.last_seen_at)
                ? 'WS 已连接'
                : isMeaningfulTime(node.last_seen_at)
                  ? formatRelativeTime(node.last_seen_at)
                  : '暂无'}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-dashed shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-semibold">隧道客户端</CardTitle>
            <CardDescription>隧道客户端节点 (tunnel_client / openflared)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">运行状态</span>
              <NodeStatusBadge
                label={getNodeStatusLabel(node.status)}
                tone={getNodeStatusTone(node.status)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">flared 状态</span>
              <NodeStatusBadge
                label={getFlaredStatusLabel(node)}
                tone={getFlaredStatusTone(node)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Tunnel Token</span>
              <span className="text-right break-all max-w-[60%]">
                {node.access_token || '暂无'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">IP 地址</span>
              <span>
                {node.ip || '—'}
                {node.ip_manual_override ? '（已锁定）' : ''}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">最近应用</span>
              <NodeStatusBadge
                label={getApplyLabel(node.latest_apply_result)}
                tone={getApplyTone(node.latest_apply_result)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">自动更新</span>
              <span>{node.auto_update_enabled ? '已启用' : '手动'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">创建时间</span>
              <span>{formatDateTime(node.created_at)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">更新时间</span>
              <span>{formatDateTime(node.updated_at)}</span>
            </div>
            {node.last_error ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-destructive">
                {node.last_error}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-dashed shadow-none">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base font-semibold">同步状态</CardTitle>
              <CardDescription>配置追平与应用结果</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
              <Link href={`/apply-logs?node_id=${encodeURIComponent(node.node_id)}`}>
                <FileText className="size-3.5 mr-1" />
                应用记录
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">最近应用结果</span>
              <NodeStatusBadge
                label={getApplyLabel(node.latest_apply_result)}
                tone={getApplyTone(node.latest_apply_result)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">最近应用时间</span>
              <span>
                {isMeaningfulTime(node.latest_apply_at) && node.latest_apply_at
                  ? `${formatRelativeTime(node.latest_apply_at)} · ${formatDateTime(node.latest_apply_at)}`
                  : '暂无'}
              </span>
            </div>
            {node.latest_apply_checksum ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">同步文件数</span>
                <span>{node.latest_support_file_count} 个</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">升级状态</span>
              <NodeStatusBadge
                label={
                  node.update_requested
                    ? node.update_channel === 'preview'
                      ? '等待预览更新'
                      : '等待更新'
                    : '未下发'
                }
                tone={node.update_requested ? 'warning' : 'info'}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">最近心跳详情</span>
              <span className="text-right">
                {isWSConnectedLastSeen(node.last_seen_at)
                  ? 'WebSocket 长连接已建立'
                  : isMeaningfulTime(node.last_seen_at)
                    ? formatDateTime(node.last_seen_at)
                    : '暂无'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <InstallCommand node={node} variant="tunnel" />

      <NodeObservability
        nodeId={node.id}
        variant="compact"
        connectionHint="隧道并发连接数"
      />

      <NodeEditorDialog
        open={editorOpen}
        node={node}
        submitting={saveMutation.isPending}
        onClose={() => setEditorOpen(false)}
        onSubmit={async (payload) => {
          await saveMutation.mutateAsync(payload);
        }}
      />

      <AgentUpdateDialog
        open={upgradeOpen}
        node={node}
        submitting={upgradeMutation.isPending}
        onClose={() => setUpgradeOpen(false)}
        onConfirm={async (release, channel) => {
          await upgradeMutation.mutateAsync({ release, channel });
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除隧道节点</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除隧道节点「{node.name}」吗？删除后该节点需要重新创建并重新接入。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}