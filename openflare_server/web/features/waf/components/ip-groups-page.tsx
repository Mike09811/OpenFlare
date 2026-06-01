'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, Plus, Save, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { InlineMessage } from '@/components/feedback/inline-message';
import { LoadingState } from '@/components/feedback/loading-state';
import { PageHeader } from '@/components/layout/page-header';
import { AppCard } from '@/components/ui/app-card';
import {
  createWAFIPGroup,
  deleteWAFIPGroup,
  getWAFIPGroups,
  syncWAFIPGroup,
  updateWAFIPGroup,
} from '@/features/waf/api/waf';
import type {
  WAFIPGroup,
  WAFIPGroupPayload,
  WAFIPGroupSubscriptionFormat,
  WAFIPGroupType,
} from '@/features/waf/types';
import {
  DangerButton,
  PrimaryButton,
  ResourceField,
  ResourceInput,
  ResourceSelect,
  ResourceTextarea,
  SecondaryButton,
  ToggleField,
} from '@/features/shared/components/resource-primitives';
import { cn } from '@/lib/utils/cn';

import { getErrorMessage, listToText, parseTextareaList } from './helpers';

type FeedbackState = {
  tone: 'success' | 'danger' | 'info';
  message: string;
};

type IPGroupDraft = WAFIPGroupPayload & {
  ip_list_text: string;
  auto_config_text: string;
};

const emptyIPGroupDraft: IPGroupDraft = {
  name: '',
  type: 'manual',
  enabled: true,
  ip_list: [],
  ip_list_text: '',
  auto_config: {},
  auto_config_text: '{}',
  subscription_url: '',
  subscription_format: 'text',
  subscription_mapping_rule: '',
  sync_interval_minutes: 1440,
  remark: '',
};

const typeLabels: Record<WAFIPGroupType, string> = {
  manual: '手动',
  automatic: '自动',
  subscription: '订阅',
};

const automaticPresetRules = [
  {
    name: '单 IP 404 高频扫描',
    expr: 'request_count > 100 && status_404_ratio >= 0.8',
  },
  {
    name: '单 IP 直连访问异常',
    expr: 'ip_host_count > 50 && ip_host_ratio > 0.5',
  },
];

function buildDraft(group: WAFIPGroup | null): IPGroupDraft {
  if (!group) {
    return { ...emptyIPGroupDraft };
  }
  return {
    name: group.name,
    type: group.type,
    enabled: group.enabled,
    ip_list: group.ip_list ?? [],
    ip_list_text: listToText(group.ip_list),
    auto_config: group.auto_config ?? {},
    auto_config_text: JSON.stringify(group.auto_config ?? {}, null, 2),
    subscription_url: group.subscription_url ?? '',
    subscription_format: group.subscription_format ?? 'text',
    subscription_mapping_rule: group.subscription_mapping_rule ?? '',
    sync_interval_minutes: group.sync_interval_minutes || 1440,
    remark: group.remark ?? '',
  };
}

function buildPayload(draft: IPGroupDraft): WAFIPGroupPayload {
  let autoConfig: Record<string, unknown> = {};
  if (draft.type === 'automatic') {
    const parsed = JSON.parse(draft.auto_config_text || '{}') as unknown;
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new Error('自动配置必须是 JSON 对象。');
    }
    autoConfig = parsed as Record<string, unknown>;
  }
  return {
    name: draft.name,
    type: draft.type,
    enabled: draft.enabled,
    ip_list: parseTextareaList(draft.ip_list_text),
    auto_config: autoConfig,
    subscription_url: draft.subscription_url,
    subscription_format: draft.subscription_format,
    subscription_mapping_rule: draft.subscription_mapping_rule,
    sync_interval_minutes: draft.sync_interval_minutes,
    remark: draft.remark,
  };
}

function appendAutomaticPresetRule(
  autoConfigText: string,
  rule: (typeof automaticPresetRules)[number],
) {
  const parsed = JSON.parse(autoConfigText || '{}') as unknown;
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('自动配置必须是 JSON 对象。');
  }
  const config = parsed as Record<string, unknown>;
  const rules = Array.isArray(config.rules) ? config.rules : [];
  const exists = rules.some(
    (item) =>
      item &&
      typeof item === 'object' &&
      'expr' in item &&
      (item as { expr?: unknown }).expr === rule.expr,
  );
  const nextRules = exists ? rules : [...rules, rule];
  return JSON.stringify(
    {
      lookback_minutes:
        typeof config.lookback_minutes === 'number'
          ? config.lookback_minutes
          : 60,
      ...config,
      rules: nextRules,
    },
    null,
    2,
  );
}

export function WAFIPGroupsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedID, setSelectedID] = useState<number | null>(null);
  const [draft, setDraft] = useState<IPGroupDraft>(emptyIPGroupDraft);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const groupsQuery = useQuery({
    queryKey: ['waf', 'ip-groups'],
    queryFn: getWAFIPGroups,
  });

  const groups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data]);
  const selectedGroup = useMemo(
    () =>
      selectedID === 0
        ? null
        : (groups.find((group) => group.id === selectedID) ??
          groups[0] ??
          null),
    [groups, selectedID],
  );

  useEffect(() => {
    if (selectedGroup) {
      setSelectedID(selectedGroup.id);
      setDraft(buildDraft(selectedGroup));
    }
  }, [selectedGroup]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['waf', 'ip-groups'] }),
      queryClient.invalidateQueries({ queryKey: ['waf', 'rule-groups'] }),
      queryClient.invalidateQueries({ queryKey: ['config-versions', 'diff'] }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: (payload: WAFIPGroupPayload) => {
      if (selectedGroup) {
        return updateWAFIPGroup(selectedGroup.id, payload);
      }
      return createWAFIPGroup(payload);
    },
    onSuccess: async (group) => {
      setSelectedID(group.id);
      setFeedback({ tone: 'success', message: 'IP 组已保存。' });
      await invalidate();
    },
    onError: (error) => {
      setFeedback({ tone: 'danger', message: getErrorMessage(error) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWAFIPGroup,
    onSuccess: async () => {
      setSelectedID(null);
      setFeedback({ tone: 'success', message: 'IP 组已删除。' });
      await invalidate();
    },
    onError: (error) => {
      setFeedback({ tone: 'danger', message: getErrorMessage(error) });
    },
  });

  const syncMutation = useMutation({
    mutationFn: syncWAFIPGroup,
    onSuccess: async (result) => {
      setSelectedID(result.group.id);
      setFeedback({ tone: 'success', message: result.message });
      await invalidate();
    },
    onError: (error) => {
      setFeedback({ tone: 'danger', message: getErrorMessage(error) });
    },
  });

  if (groupsQuery.isLoading) {
    return <LoadingState />;
  }
  if (groupsQuery.isError) {
    return (
      <ErrorState
        title="IP 组加载失败"
        description={getErrorMessage(groupsQuery.error)}
      />
    );
  }

  const saveDraft = () => {
    try {
      saveMutation.mutate(buildPayload(draft));
    } catch (error) {
      setFeedback({ tone: 'danger', message: getErrorMessage(error) });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="IP 组"
        description="维护可被 WAF IP 黑白名单引用的手动、自动与订阅 IP 集合。"
        action={
          <div className="flex flex-wrap gap-3">
            <SecondaryButton type="button" onClick={() => router.push('/waf')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回 WAF
            </SecondaryButton>
            <PrimaryButton
              type="button"
              onClick={() => {
                setSelectedID(0);
                setDraft({ ...emptyIPGroupDraft, name: '自定义 IP 组' });
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              新建 IP 组
            </PrimaryButton>
          </div>
        }
      />

      {feedback ? (
        <InlineMessage tone={feedback.tone} message={feedback.message} />
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <AppCard title="IP 组列表">
          {groups.length === 0 && selectedID !== 0 ? (
            <EmptyState title="暂无 IP 组" />
          ) : (
            <div className="space-y-2">
              {groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setSelectedID(group.id)}
                  className={cn(
                    'w-full rounded-2xl border px-4 py-3 text-left transition',
                    selectedGroup?.id === group.id
                      ? 'border-[var(--border-strong)] bg-[var(--accent-soft)]'
                      : 'border-[var(--border-default)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-muted)]',
                  )}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-semibold text-[var(--foreground-primary)]">
                      {group.name}
                    </span>
                    <span className="text-xs text-[var(--foreground-secondary)]">
                      {typeLabels[group.type]}
                    </span>
                  </span>
                  <span className="mt-2 block text-xs text-[var(--foreground-secondary)]">
                    {group.enabled ? '启用' : '停用'} · {group.ip_list.length}{' '}
                    条 · 被引用 {group.referenced_by_rule_count} 次
                  </span>
                </button>
              ))}
            </div>
          )}
        </AppCard>

        <AppCard
          title={selectedGroup ? selectedGroup.name : '新建 IP 组'}
          description={
            draft.type === 'automatic'
              ? '自动 IP 组会按 Expr 规则定时从请求日志中聚合命中 IP。'
              : '保存后可在 WAF 规则组黑白名单中引用。'
          }
          action={
            <div className="flex flex-wrap gap-3">
              {selectedGroup?.type === 'subscription' ||
              selectedGroup?.type === 'automatic' ? (
                <SecondaryButton
                  type="button"
                  disabled={syncMutation.isPending}
                  onClick={() => syncMutation.mutate(selectedGroup.id)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {syncMutation.isPending
                    ? '执行中...'
                    : selectedGroup.type === 'automatic'
                      ? '立即执行'
                      : '立即同步'}
                </SecondaryButton>
              ) : null}
              <PrimaryButton
                type="button"
                disabled={saveMutation.isPending}
                onClick={saveDraft}
              >
                <Save className="mr-2 h-4 w-4" />
                {saveMutation.isPending ? '保存中...' : '保存 IP 组'}
              </PrimaryButton>
            </div>
          }
        >
          <div className="space-y-6">
            <div className="grid gap-5 xl:grid-cols-2">
              <ResourceField label="IP 组名称">
                <ResourceInput
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </ResourceField>
              <ResourceField label="类型">
                <ResourceSelect
                  value={draft.type}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      type: event.target.value as WAFIPGroupType,
                    }))
                  }
                >
                  <option value="manual">手动</option>
                  <option value="automatic">自动</option>
                  <option value="subscription">订阅</option>
                </ResourceSelect>
              </ResourceField>
              <ToggleField
                label="启用 IP 组"
                description="关闭后保留配置，但发布时不会展开到 WAF 运行时名单。"
                checked={draft.enabled}
                onChange={(checked) =>
                  setDraft((current) => ({ ...current, enabled: checked }))
                }
              />
              <ResourceField label="备注">
                <ResourceInput
                  value={draft.remark}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      remark: event.target.value,
                    }))
                  }
                />
              </ResourceField>
            </div>

            {draft.type === 'subscription' ? (
              <div className="grid gap-5 xl:grid-cols-2">
                <ResourceField label="订阅 URL">
                  <ResourceInput
                    value={draft.subscription_url}
                    placeholder="https://example.com/ip-list.txt"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        subscription_url: event.target.value,
                      }))
                    }
                  />
                </ResourceField>
                <ResourceField label="订阅格式">
                  <ResourceSelect
                    value={draft.subscription_format}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        subscription_format: event.target
                          .value as WAFIPGroupSubscriptionFormat,
                      }))
                    }
                  >
                    <option value="text">文本列表</option>
                    <option value="json">JSON</option>
                  </ResourceSelect>
                </ResourceField>
                <ResourceField
                  label="同步间隔（分钟）"
                  hint="最小 5 分钟，默认 1440 分钟。"
                >
                  <ResourceInput
                    type="number"
                    min={5}
                    value={draft.sync_interval_minutes}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        sync_interval_minutes: Number(event.target.value),
                      }))
                    }
                  />
                </ResourceField>
                <ResourceField
                  label="JSON 映射规则"
                  hint="留空表示根数组；示例：data.items[]。文本格式无需填写。"
                >
                  <ResourceInput
                    value={draft.subscription_mapping_rule}
                    disabled={draft.subscription_format !== 'json'}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        subscription_mapping_rule: event.target.value,
                      }))
                    }
                  />
                </ResourceField>
              </div>
            ) : null}

            {draft.type === 'automatic' ? (
              <div className="space-y-4">
                <ResourceField
                  label="预设规则"
                  hint="表达式按单个 IP 的请求日志聚合指标计算。"
                  container="div"
                >
                  <div className="flex flex-wrap gap-2">
                    {automaticPresetRules.map((rule) => (
                      <SecondaryButton
                        key={rule.expr}
                        type="button"
                        onClick={() => {
                          try {
                            setDraft((current) => ({
                              ...current,
                              auto_config_text: appendAutomaticPresetRule(
                                current.auto_config_text,
                                rule,
                              ),
                            }));
                          } catch (error) {
                            setFeedback({
                              tone: 'danger',
                              message: getErrorMessage(error),
                            });
                          }
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        {rule.name}
                      </SecondaryButton>
                    ))}
                  </div>
                </ResourceField>
                <ResourceField
                  label="自动配置 JSON"
                  hint="可用字段：request_count、status_404_count、status_404_ratio、ip_host_count、ip_host_ratio。"
                >
                  <ResourceTextarea
                    value={draft.auto_config_text}
                    className="min-h-64 font-mono"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        auto_config_text: event.target.value,
                      }))
                    }
                  />
                </ResourceField>
              </div>
            ) : (
              <ResourceField
                label="IP / IP 段"
                hint={
                  draft.type === 'subscription'
                    ? '订阅同步会覆盖此列表；也可以先手动保存当前内容。'
                    : '支持单个 IP 或 CIDR，每行一个。'
                }
              >
                <ResourceTextarea
                  value={draft.ip_list_text}
                  className="min-h-72 font-mono"
                  placeholder={'203.0.113.10\n198.51.100.0/24'}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      ip_list_text: event.target.value,
                    }))
                  }
                />
              </ResourceField>
            )}

            {selectedGroup ? (
              <div className="flex flex-wrap justify-between gap-3 border-t border-[var(--border-default)] pt-6">
                <div className="text-sm text-[var(--foreground-secondary)]">
                  {selectedGroup.last_sync_status
                    ? `${selectedGroup.last_sync_status}: ${selectedGroup.last_sync_message}`
                    : '尚无同步记录'}
                </div>
                <DangerButton
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `确认删除 IP 组 ${selectedGroup.name} 吗？`,
                      )
                    ) {
                      deleteMutation.mutate(selectedGroup.id);
                    }
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除
                </DangerButton>
              </div>
            ) : null}
          </div>
        </AppCard>
      </div>
    </div>
  );
}
