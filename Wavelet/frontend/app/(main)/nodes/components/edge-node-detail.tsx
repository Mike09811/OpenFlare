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
import {Card, CardContent, CardDescription, CardHeader, CardTitle,} from '@/components/ui/card';
import {formatDateTime} from '@/lib/utils';
import type {NodeAgentReleaseInfo, NodeItem, ReleaseChannel} from '@/lib/services/openflare';
import {NodeService} from '@/lib/services/openflare';

import {AgentUpdateDialog} from './agent-update-dialog';
import {NodeEditorDialog} from './node-editor-dialog';
import {NodeObservability} from './node-observability';
import {NodeStatusBadge} from './node-status-badge';
import {
  formatRelativeTime,
  getApplyLabel,
  getApplyTone,
  getErrorMessage,
  getNodeStatusLabel,
  getNodeStatusTone,
  getOpenrestyStatusLabel,
  getOpenrestyStatusTone,
  isMeaningfulTime,
} from './node-utils';

const nodesQueryKey = ['openflare', 'nodes'];

export function EdgeNodeDetail({ node }: { node: NodeItem }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const saveMutation = useMutation({
    mutationFn: (payload: Parameters<typeof NodeService.updateNode>[1]) =>
      NodeService.updateNode(node.id, payload),
    onSuccess: async () => {
      toast.success('节点已更新');
      setEditorOpen(false);
      await queryClient.invalidateQueries({ queryKey: nodesQueryKey });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const forceSyncMutation = useMutation({
    mutationFn: () => NodeService.requestForceSync(node.id),
    onSuccess: async (updated) => {
      toast.success(`已向节点 ${updated.name} 下发强制同步指令`);
      await queryClient.invalidateQueries({ queryKey: nodesQueryKey });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const restartMutation = useMutation({
    mutationFn: () => NodeService.requestOpenrestyRestart(node.id),
    onSuccess: async (updated) => {
      toast.success(`已向节点 ${updated.name} 下发 OpenResty 重启指令`);
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
        `已向节点 ${updated.name} 下发${updated.update_channel === 'preview' ? '预览版' : '正式版'}升级指令`,
      );
      setUpgradeOpen(false);
      await queryClient.invalidateQueries({ queryKey: nodesQueryKey });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => NodeService.deleteNode(node.id),
    onSuccess: async () => {
      toast.success('节点已删除');
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
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={handleRefresh}
            disabled={false}
          >
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
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={restartMutation.isPending}
            onClick={() => restartMutation.mutate()}
          >
            {restartMutation.isPending ? '下发中...' : '重启 OpenResty'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setUpgradeOpen(true)}
          >
            <Upload className="size-3.5 mr-1" />
            {node.update_requested ? '查看升级' : '升级 Agent'}
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
            <CardDescription>Agent 版本</CardDescription>
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
              {isMeaningfulTime(node.last_seen_at)
                ? formatRelativeTime(node.last_seen_at)
                : '暂无'}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-dashed shadow-none">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base font-semibold">节点信息</CardTitle>
            <CardDescription>边缘代理节点 (edge_node)</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
            <Link href={`/apply-logs?node_id=${encodeURIComponent(node.node_id)}`}>
              <FileText className="size-3.5 mr-1" />
              应用记录
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">运行状态</span>
            <NodeStatusBadge
              label={getNodeStatusLabel(node.status)}
              tone={getNodeStatusTone(node.status)}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">OpenResty 健康</span>
            <NodeStatusBadge
              label={getOpenrestyStatusLabel(node.openresty_status)}
              tone={getOpenrestyStatusTone(node.openresty_status)}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">最近应用</span>
            <NodeStatusBadge
              label={getApplyLabel(node.latest_apply_result)}
              tone={getApplyTone(node.latest_apply_result)}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">IP 地址</span>
            <span>
              {node.ip || '—'}
              {node.ip_manual_override ? '（已锁定）' : ''}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">地图点位</span>
            <span>{node.geo_name || '未配置'}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">OpenResty 状态消息</span>
            <span className="text-right max-w-[60%] break-words">
              {node.openresty_message || '无'}
            </span>
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
            <div className="md:col-span-2 xl:col-span-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-destructive">
              {node.last_error}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <NodeObservability
        nodeId={node.id}
        node={node}
        variant="edge"
        connectionHint="OpenResty 当前连接"
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
            <AlertDialogTitle>确认删除节点</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除节点「{node.name}」吗？删除后该节点需要重新创建并重新接入。
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
