'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import Link from 'next/link';

import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { InlineMessage } from '@/components/feedback/inline-message';
import { LoadingState } from '@/components/feedback/loading-state';
import { PageHeader } from '@/components/layout/page-header';
import { AppCard } from '@/components/ui/app-card';
import { StatusBadge } from '@/components/ui/status-badge';

import {
  createTunnel,
  deleteTunnel,
  getTunnels,
  updateTunnel,
  rotateTunnelToken,
} from '@/features/tunnels/api/tunnels';
import { TunnelEditorModal } from '@/features/tunnels/components/tunnel-editor-modal';
import { TunnelDeploymentModal } from '@/features/tunnels/components/tunnel-deployment-modal';
import type { TunnelItem, TunnelMutationPayload } from '@/features/tunnels/types';
import { PrimaryButton } from '@/features/shared/components/resource-primitives';
import { formatRelativeTime } from '@/lib/utils/date';
import { isMeaningfulTime } from '@/features/nodes/utils';

const tunnelsQueryKey = ['tunnels'];

type FeedbackState = {
  tone: 'info' | 'success' | 'danger';
  message: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '请求失败，请稍后重试。';
}

export function TunnelsPage() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  
  const [editingTunnel, setEditingTunnel] = useState<TunnelItem | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  
  const [deploymentTunnel, setDeploymentTunnel] = useState<TunnelItem | null>(null);
  const [isDeploymentOpen, setIsDeploymentOpen] = useState(false);

  const tunnelsQuery = useQuery({
    queryKey: tunnelsQueryKey,
    queryFn: getTunnels,
    refetchInterval: 5000,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: TunnelMutationPayload) => {
      return editingTunnel
        ? updateTunnel(editingTunnel.id, payload)
        : createTunnel(payload);
    },
    onSuccess: async () => {
      setFeedback({
        tone: 'success',
        message: editingTunnel ? '隧道已更新。' : '隧道已创建。',
      });
      setEditingTunnel(null);
      setIsEditorOpen(false);
      await queryClient.invalidateQueries({ queryKey: tunnelsQueryKey });
    },
    onError: (error) => {
      setFeedback({ tone: 'danger', message: getErrorMessage(error) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTunnel,
    onSuccess: async () => {
      setFeedback({ tone: 'success', message: '隧道已删除。' });
      await queryClient.invalidateQueries({ queryKey: tunnelsQueryKey });
    },
    onError: (error) => {
      setFeedback({ tone: 'danger', message: getErrorMessage(error) });
    },
  });

  const rotateTokenMutation = useMutation({
    mutationFn: rotateTunnelToken,
    onSuccess: async () => {
      setFeedback({ tone: 'success', message: '隧道 Token 已轮转，客户端需要重新部署连接。' });
      await queryClient.invalidateQueries({ queryKey: tunnelsQueryKey });
    },
    onError: (error) => {
      setFeedback({ tone: 'danger', message: getErrorMessage(error) });
    },
  });

  const tunnels = useMemo(() => tunnelsQuery.data ?? [], [tunnelsQuery.data]);

  const handleResetEditor = () => {
    setFeedback(null);
    setEditingTunnel(null);
    setIsEditorOpen(false);
  };

  const handleCreate = () => {
    setFeedback(null);
    setEditingTunnel(null);
    setIsEditorOpen(true);
  };

  const handleEdit = (tunnel: TunnelItem) => {
    setFeedback(null);
    setEditingTunnel(tunnel);
    setIsEditorOpen(true);
  };

  const handleDeployment = (tunnel: TunnelItem) => {
    setFeedback(null);
    setDeploymentTunnel(tunnel);
    setIsDeploymentOpen(true);
  };

  const handleDelete = (tunnelId: number, tunnelName: string) => {
    if (
      !window.confirm(
        `确认删除隧道“${tunnelName}”吗？删除后该隧道的连接将立即中断。`,
      )
    ) {
      return;
    }
    setFeedback(null);
    deleteMutation.mutate(tunnelId);
  };

  const handleRotateToken = (tunnelId: number, tunnelName: string) => {
    if (
      !window.confirm(
        `确认重置隧道“${tunnelName}”的 Token 吗？已连接的客户端将被断开，并且需要使用新的 Token 重新部署。`,
      )
    ) {
      return;
    }
    setFeedback(null);
    rotateTokenMutation.mutate(tunnelId);
  };

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="内网穿透隧道"
          description="管理你的内网穿透隧道。"
          action={
            <PrimaryButton type="button" onClick={handleCreate}>
              新建 Tunnel
            </PrimaryButton>
          }
        />

        {feedback ? (
          <InlineMessage
            tone={feedback.tone}
            message={feedback.message}
            onClear={() => setFeedback(null)}
          />
        ) : null}

        <AppCard
          title="隧道列表"
          description="列表每 5 秒自动刷新一次。"
        >
          {tunnelsQuery.isLoading ? (
            <LoadingState />
          ) : tunnelsQuery.isError ? (
            <ErrorState
              title="隧道列表加载失败"
              description={getErrorMessage(tunnelsQuery.error)}
            />
          ) : tunnels.length === 0 ? (
            <EmptyState
              title="当前还没有隧道"
              description="点击右上角的“新建 Tunnel”按钮创建你的第一个隧道。"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--border-default)] text-left text-sm">
                <thead>
                  <tr className="text-[var(--foreground-secondary)]">
                    <th className="px-3 py-3 font-medium">名称 / 隧道ID</th>
                    <th className="px-3 py-3 font-medium">状态</th>
                    <th className="px-3 py-3 font-medium">版本 / 校验</th>
                    <th className="px-3 py-3 font-medium">已连接 Relay</th>
                    <th className="px-3 py-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {tunnels.map((tunnel) => (
                    <tr key={tunnel.id} className="align-top">
                      <td className="px-3 py-4">
                        <div className="space-y-1">
                          <p className="font-medium text-[var(--foreground-primary)]">
                            {tunnel.name}
                          </p>
                          <p className="text-xs text-[var(--foreground-secondary)]">
                            {tunnel.tunnel_id.slice(0, 8)}...
                          </p>
                          {tunnel.remark ? (
                            <p className="text-xs text-[var(--foreground-muted)] line-clamp-1 max-w-xs">
                              {tunnel.remark}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <div className="space-y-2">
                          <StatusBadge
                            label={tunnel.status === 'online' ? '在线' : '离线'}
                            variant={tunnel.status === 'online' ? 'success' : 'danger'}
                          />
                          {tunnel.status === 'online' && isMeaningfulTime(tunnel.last_seen_at) ? (
                            <p className="text-xs text-[var(--foreground-secondary)]">
                              活跃：{formatRelativeTime(tunnel.last_seen_at)}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <div className="space-y-1 text-[var(--foreground-secondary)]">
                          <p>
                            版本：{tunnel.current_version || '未知'}
                          </p>
                          <p className="text-xs" title={tunnel.current_checksum}>
                            {tunnel.current_checksum
                              ? `签名：${tunnel.current_checksum.slice(0, 12)}...`
                              : '签名：未知'}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-[var(--foreground-secondary)]">
                        {tunnel.connected_relays && tunnel.connected_relays.length > 0 ? (
                          <div className="space-y-1">
                            {tunnel.connected_relays.map((relay, index) => (
                              <p key={index} className="text-xs">
                                {relay}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs">暂无</p>
                        )}
                      </td>
                      <td className="px-3 py-4 text-right">
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => handleDeployment(tunnel)}
                              className="text-sm font-medium text-blue-600 transition hover:text-blue-700 dark:text-blue-500 dark:hover:text-blue-400"
                            >
                              部署命令
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEdit(tunnel)}
                              className="text-sm font-medium text-[var(--foreground-primary)] transition hover:text-blue-600 dark:hover:text-blue-500"
                            >
                              编辑
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(tunnel.id, tunnel.name)}
                              className="text-sm font-medium text-red-600 transition hover:text-red-700 dark:text-red-500 dark:hover:text-red-400"
                            >
                              删除
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRotateToken(tunnel.id, tunnel.name)}
                            className="text-xs font-medium text-amber-600 transition hover:text-amber-700 dark:text-amber-500 dark:hover:text-amber-400"
                          >
                            重置 Token
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AppCard>
      </div>

      <TunnelEditorModal
        isOpen={isEditorOpen}
        tunnel={editingTunnel}
        isSubmitting={saveMutation.isPending}
        title={editingTunnel ? '编辑隧道' : '新建隧道'}
        description={
          editingTunnel
            ? '修改此隧道的名称和备注。'
            : '创建一个内网穿透隧道，稍后你将获得用于客户端连接的 Token 和部署命令。'
        }
        submitLabel={editingTunnel ? '保存修改' : '确认创建'}
        onClose={handleResetEditor}
        onSubmit={(payload) => {
          setFeedback(null);
          saveMutation.mutate(payload);
        }}
      />
      
      <TunnelDeploymentModal
        isOpen={isDeploymentOpen}
        tunnel={deploymentTunnel}
        onClose={() => setIsDeploymentOpen(false)}
      />
    </>
  );
}
