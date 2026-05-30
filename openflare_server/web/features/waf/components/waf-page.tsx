'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Globe2,
  ListFilter,
  type LucideIcon,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { InlineMessage } from '@/components/feedback/inline-message';
import { LoadingState } from '@/components/feedback/loading-state';
import { PageHeader } from '@/components/layout/page-header';
import { AppCard } from '@/components/ui/app-card';
import { AppModal } from '@/components/ui/app-modal';
import { Drawer } from '@/components/ui/drawer';
import { getProxyRoutes } from '@/features/proxy-routes/api/proxy-routes';
import type { ProxyRouteItem } from '@/features/proxy-routes/types';
import {
  DangerButton,
  PrimaryButton,
  ResourceField,
  ResourceInput,
  ResourceTextarea,
  SecondaryButton,
  ToggleField,
} from '@/features/shared/components/resource-primitives';
import {
  createWAFRuleGroup,
  deleteWAFRuleGroup,
  getWAFRuleGroups,
  replaceWAFRuleGroupSites,
  updateWAFRuleGroup,
} from '@/features/waf/api/waf';
import type { WAFRuleGroup, WAFRuleGroupPayload } from '@/features/waf/types';
import { cn } from '@/lib/utils/cn';

type FeedbackState = {
  tone: 'success' | 'danger' | 'info';
  message: string;
};

type WAFTab = 'basic' | 'lists' | 'block';
type RuleListType = 'whitelist' | 'blacklist';
type RuleDimension = 'ip' | 'country';
type ListFieldKey =
  | 'ip_whitelist'
  | 'ip_blacklist'
  | 'country_whitelist'
  | 'country_blacklist';

type CountryOption = {
  code: string;
  zhName: string;
  label: string;
  searchText: string;
};

type RuleModalState = {
  open: boolean;
  listType: RuleListType;
  dimension: RuleDimension;
  ipValue: string;
  countryValues: string[];
};

type RuleListRenderable = Pick<
  WAFRuleGroupPayload,
  | 'ip_whitelist'
  | 'ip_blacklist'
  | 'country_whitelist'
  | 'country_blacklist'
  | 'region_whitelist'
  | 'region_blacklist'
>;

const emptyDraft: WAFRuleGroupPayload = {
  name: '',
  enabled: true,
  block_status_code: 418,
  block_response_body: '',
  ip_whitelist: [],
  ip_blacklist: [],
  country_whitelist: [],
  country_blacklist: [],
  region_whitelist: [],
  region_blacklist: [],
  remark: '',
};

const defaultRuleModalState: RuleModalState = {
  open: false,
  listType: 'whitelist',
  dimension: 'ip',
  ipValue: '',
  countryValues: [],
};

const tabItems: Array<{
  id: WAFTab;
  label: string;
}> = [
  {
    id: 'basic',
    label: '基本信息',
  },
  {
    id: 'lists',
    label: '黑白名单',
  },
  {
    id: 'block',
    label: '拦截返回',
  },
];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败';
}

function textToList(text: string) {
  return text
    .split(/[\n,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeItems(items: string[]) {
  return Array.from(
    new Set(items.map((item) => item.trim()).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));
}

function buildDraft(group: WAFRuleGroup | null): WAFRuleGroupPayload {
  if (!group) {
    return { ...emptyDraft };
  }
  return {
    name: group.name,
    enabled: group.enabled,
    block_status_code: group.block_status_code || 418,
    block_response_body: group.block_response_body ?? '',
    ip_whitelist: group.ip_whitelist ?? [],
    ip_blacklist: group.ip_blacklist ?? [],
    country_whitelist: group.country_whitelist ?? [],
    country_blacklist: group.country_blacklist ?? [],
    region_whitelist: group.region_whitelist ?? [],
    region_blacklist: group.region_blacklist ?? [],
    remark: group.remark ?? '',
  };
}

function countRuleEntries(group: RuleListRenderable) {
  return (
    group.ip_whitelist.length +
    group.ip_blacklist.length +
    group.country_whitelist.length +
    group.country_blacklist.length +
    group.region_whitelist.length +
    group.region_blacklist.length
  );
}

function buildCountryOptions() {
  const zhDisplayNames = new Intl.DisplayNames(['zh-CN'], { type: 'region' });
  const enDisplayNames = new Intl.DisplayNames(['en'], { type: 'region' });
  const options: CountryOption[] = [];

  for (let first = 65; first <= 90; first += 1) {
    for (let second = 65; second <= 90; second += 1) {
      const code = String.fromCharCode(first, second);
      const zhName = zhDisplayNames.of(code);
      const enName = enDisplayNames.of(code);

      if (
        !zhName ||
        zhName === code ||
        /未知/.test(zhName) ||
        !enName ||
        enName === code ||
        /Unknown/.test(enName)
      ) {
        continue;
      }

      options.push({
        code,
        zhName,
        label: `${code} ${zhName}`,
        searchText: `${code} ${zhName} ${enName}`.toLowerCase(),
      });
    }
  }

  return options.sort((left, right) => left.code.localeCompare(right.code));
}

function getListFieldKey(
  listType: RuleListType,
  dimension: RuleDimension,
): ListFieldKey {
  if (dimension === 'ip') {
    return listType === 'whitelist' ? 'ip_whitelist' : 'ip_blacklist';
  }
  return listType === 'whitelist' ? 'country_whitelist' : 'country_blacklist';
}

function updateDraftList(
  draft: WAFRuleGroupPayload,
  key: ListFieldKey,
  updater: (items: string[]) => string[],
) {
  switch (key) {
    case 'ip_whitelist':
      return { ...draft, ip_whitelist: updater(draft.ip_whitelist) };
    case 'ip_blacklist':
      return { ...draft, ip_blacklist: updater(draft.ip_blacklist) };
    case 'country_whitelist':
      return { ...draft, country_whitelist: updater(draft.country_whitelist) };
    case 'country_blacklist':
      return { ...draft, country_blacklist: updater(draft.country_blacklist) };
  }
}

function formatCountryItem(code: string, labelMap: Map<string, string>) {
  return labelMap.get(code) ?? code;
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[26px] border border-[var(--border-default)] bg-[var(--surface-elevated)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-[0.22em] text-[var(--foreground-muted)] uppercase">
            {label}
          </p>
          <p className="text-2xl font-semibold text-[var(--foreground-primary)]">
            {value}
          </p>
        </div>
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--surface-panel)] text-[var(--foreground-primary)]">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {hint && (
        <p className="mt-3 text-sm leading-6 text-[var(--foreground-secondary)]">
          {hint}
        </p>
      )}
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group rounded-[24px] border px-4 py-4 text-left transition',
        active
          ? 'border-[var(--border-strong)] bg-[var(--accent-soft)] shadow-[var(--shadow-soft)]'
          : 'border-[var(--border-default)] bg-[var(--surface-elevated)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]',
      )}
    >
      <p className="text-sm font-semibold text-[var(--foreground-primary)]">
        {label}
      </p>
    </button>
  );
}

function RuleChip({
  label,
  tone,
  onRemove,
}: {
  label: string;
  tone: 'whitelist' | 'blacklist';
  onRemove: () => void;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm',
        tone === 'whitelist'
          ? 'border-emerald-500/30 bg-emerald-500/18 text-[var(--foreground-primary)]'
          : 'border-rose-500/30 bg-rose-500/18 text-[var(--foreground-primary)]',
      )}
    >
      <span className="break-all">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current/20 text-xs text-[var(--foreground-primary)] transition hover:bg-black/10"
        aria-label={`移除 ${label}`}
      >
        ×
      </button>
    </span>
  );
}

function RuleListSection({
  title,
  description,
  items,
  tone,
  emptyText,
  onRemove,
}: {
  title: string;
  description: string;
  items: string[];
  tone: 'whitelist' | 'blacklist';
  emptyText: string;
  onRemove: (item: string) => void;
}) {
  return (
    <div className="rounded-[26px] border border-[var(--border-default)] bg-[var(--surface-elevated)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--foreground-primary)]">
            {title}
          </h3>
          <p className="mt-1 text-xs leading-5 text-[var(--foreground-secondary)]">
            {description}
          </p>
        </div>
        <span className="rounded-full border border-[var(--border-default)] px-2.5 py-1 text-xs font-medium text-[var(--foreground-secondary)]">
          {items.length}
        </span>
      </div>
      {items.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {items.map((item) => (
            <RuleChip
              key={item}
              label={item}
              tone={tone}
              onRemove={() => onRemove(item)}
            />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-[var(--border-default)] px-4 py-6 text-sm text-[var(--foreground-secondary)]">
          {emptyText}
        </div>
      )}
    </div>
  );
}

function RuleEntryModal({
  state,
  countryOptions,
  pending,
  onClose,
  onChange,
  onSubmit,
}: {
  state: RuleModalState;
  countryOptions: CountryOption[];
  pending: boolean;
  onClose: () => void;
  onChange: (patch: Partial<RuleModalState>) => void;
  onSubmit: () => void;
}) {
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    if (!state.open) {
      return;
    }
    setKeyword('');
  }, [state.dimension, state.open]);

  const selectedCountrySet = useMemo(
    () => new Set(state.countryValues),
    [state.countryValues],
  );

  const filteredCountries = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();

    return countryOptions
      .filter((option) => !normalized || option.searchText.includes(normalized))
      .sort((left, right) => {
        const leftSelected = selectedCountrySet.has(left.code) ? 1 : 0;
        const rightSelected = selectedCountrySet.has(right.code) ? 1 : 0;
        return (
          rightSelected - leftSelected || left.code.localeCompare(right.code)
        );
      });
  }, [countryOptions, keyword, selectedCountrySet]);

  const toggleCountry = (code: string) => {
    const values = selectedCountrySet.has(code)
      ? state.countryValues.filter((item) => item !== code)
      : normalizeItems([...state.countryValues, code]);
    onChange({ countryValues: values });
  };

  const selectFiltered = () => {
    onChange({
      countryValues: normalizeItems([
        ...state.countryValues,
        ...filteredCountries.map((option) => option.code),
      ]),
    });
  };

  const clearCountries = () => onChange({ countryValues: [] });

  const typeLabel = state.listType === 'whitelist' ? '白名单' : '黑名单';
  const dimensionLabel = state.dimension === 'ip' ? 'IP' : '地域';

  return (
    <AppModal
      isOpen={state.open}
      title={`添加${typeLabel}规则`}
      description={`当前准备新增 ${dimensionLabel} 维度的${typeLabel}项。`}
      size="lg"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-3">
          <SecondaryButton type="button" onClick={onClose}>
            取消
          </SecondaryButton>
          <PrimaryButton type="button" disabled={pending} onClick={onSubmit}>
            {pending ? '处理中...' : '添加'}
          </PrimaryButton>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-5 md:grid-cols-2">
          <ResourceField label="类型" container="div">
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'blacklist', label: '黑名单' },
                { value: 'whitelist', label: '白名单' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    onChange({ listType: option.value as RuleListType })
                  }
                  className={cn(
                    'rounded-2xl border px-4 py-3 text-sm font-medium transition',
                    state.listType === option.value
                      ? 'border-[var(--border-strong)] bg-[var(--accent-soft)] text-[var(--foreground-primary)]'
                      : 'border-[var(--border-default)] bg-[var(--surface-elevated)] text-[var(--foreground-secondary)] hover:bg-[var(--surface-muted)]',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </ResourceField>
          <ResourceField label="维度" container="div">
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'ip', label: 'IP' },
                { value: 'country', label: '地域' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    onChange({ dimension: option.value as RuleDimension })
                  }
                  className={cn(
                    'rounded-2xl border px-4 py-3 text-sm font-medium transition',
                    state.dimension === option.value
                      ? 'border-[var(--border-strong)] bg-[var(--accent-soft)] text-[var(--foreground-primary)]'
                      : 'border-[var(--border-default)] bg-[var(--surface-elevated)] text-[var(--foreground-secondary)] hover:bg-[var(--surface-muted)]',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </ResourceField>
        </div>

        {state.dimension === 'ip' ? (
          <ResourceField
            label="IP / IP 段"
            hint="支持单个 IP、CIDR，或使用换行/逗号一次添加多个。"
          >
            <ResourceTextarea
              value={state.ipValue}
              placeholder="例如 1.1.1.1 或 192.168.0.0/24"
              onChange={(event) => onChange({ ipValue: event.target.value })}
            />
          </ResourceField>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-elevated)] px-4 py-3">
              <Search className="h-4 w-4 text-[var(--foreground-secondary)]" />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索国家代码或中文名"
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--foreground-primary)] outline-none placeholder:text-[var(--foreground-muted)]"
              />
              <button
                type="button"
                onClick={selectFiltered}
                className="text-xs font-medium text-[var(--brand-primary)]"
              >
                全选当前
              </button>
              <button
                type="button"
                onClick={clearCountries}
                className="text-xs font-medium text-[var(--foreground-secondary)]"
              >
                清空
              </button>
            </div>

            <div className="rounded-[26px] border border-[var(--border-default)] bg-[var(--surface-elevated)] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--foreground-primary)]">
                    地域多选
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-[var(--foreground-secondary)]">
                    选项显示为「国家代码 国家中文名」。
                  </p>
                </div>
                <span className="rounded-full border border-[var(--border-default)] px-2.5 py-1 text-xs font-medium text-[var(--foreground-secondary)]">
                  已选 {state.countryValues.length}
                </span>
              </div>

              <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
                {filteredCountries.map((option) => {
                  const selected = selectedCountrySet.has(option.code);
                  return (
                    <label
                      key={option.code}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition',
                        selected
                          ? 'border-[var(--border-strong)] bg-[var(--accent-soft)]'
                          : 'border-[var(--border-default)] bg-[var(--surface-panel)] hover:bg-[var(--surface-muted)]',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleCountry(option.code)}
                        className="h-4 w-4 rounded border-[var(--border-default)] accent-[var(--brand-primary)]"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-[var(--foreground-primary)]">
                          {option.label}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppModal>
  );
}

function SiteApplyDrawer({
  group,
  routes,
  open,
  onOpenChange,
  onSave,
  pending,
}: {
  group: WAFRuleGroup | null;
  routes: ProxyRouteItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (ids: number[]) => void;
  pending: boolean;
}) {
  const [keyword, setKeyword] = useState('');
  const [selectedIDs, setSelectedIDs] = useState<number[]>([]);

  useEffect(() => {
    setSelectedIDs(group?.applied_site_ids ?? []);
    setKeyword('');
  }, [group, open]);

  const filteredRoutes = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
      return routes;
    }
    return routes.filter((route) =>
      [route.site_name, route.primary_domain, ...route.domains]
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    );
  }, [keyword, routes]);

  const selectedSet = useMemo(() => new Set(selectedIDs), [selectedIDs]);
  const toggleID = (id: number) => {
    setSelectedIDs((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id].sort((left, right) => left - right),
    );
  };

  const selectFiltered = () => {
    const next = new Set(selectedIDs);
    filteredRoutes.forEach((route) => next.add(route.id));
    setSelectedIDs([...next].sort((left, right) => left - right));
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="right"
      title={group ? `应用 ${group.name}` : '应用规则组'}
      description="选择这个自定义规则组要叠加到哪些网站。"
      footer={
        <div className="flex justify-end gap-3">
          <SecondaryButton type="button" onClick={() => onOpenChange(false)}>
            取消
          </SecondaryButton>
          <PrimaryButton
            type="button"
            disabled={!group || pending}
            onClick={() => onSave(selectedIDs)}
          >
            {pending ? '保存中...' : '保存应用范围'}
          </PrimaryButton>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-elevated)] px-4 py-3">
          <Search className="h-4 w-4 text-[var(--foreground-secondary)]" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索网站或域名"
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--foreground-primary)] outline-none placeholder:text-[var(--foreground-muted)]"
          />
          <button
            type="button"
            onClick={selectFiltered}
            className="text-xs font-medium text-[var(--brand-primary)]"
          >
            全选当前
          </button>
        </div>
        <div className="space-y-2">
          {filteredRoutes.map((route) => (
            <button
              key={route.id}
              type="button"
              onClick={() => toggleID(route.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition',
                selectedSet.has(route.id)
                  ? 'border-[var(--border-strong)] bg-[var(--accent-soft)]'
                  : 'border-[var(--border-default)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-muted)]',
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-md border',
                  selectedSet.has(route.id)
                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-[var(--foreground-inverse)]'
                    : 'border-[var(--border-default)]',
                )}
              >
                {selectedSet.has(route.id) ? (
                  <Check className="h-3 w-3" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-[var(--foreground-primary)]">
                  {route.site_name}
                </span>
                <span className="block truncate text-xs text-[var(--foreground-secondary)]">
                  {route.domains.join(', ')}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </Drawer>
  );
}

export function WAFPage() {
  const queryClient = useQueryClient();
  const [selectedID, setSelectedID] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<WAFTab>('basic');
  const [draft, setDraft] = useState<WAFRuleGroupPayload>(emptyDraft);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [applyGroup, setApplyGroup] = useState<WAFRuleGroup | null>(null);
  const [ruleModal, setRuleModal] = useState<RuleModalState>(
    defaultRuleModalState,
  );

  const groupsQuery = useQuery({
    queryKey: ['waf', 'rule-groups'],
    queryFn: getWAFRuleGroups,
  });
  const routesQuery = useQuery({
    queryKey: ['proxy-routes'],
    queryFn: getProxyRoutes,
  });

  const groups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data]);
  const routes = useMemo(() => routesQuery.data ?? [], [routesQuery.data]);
  const countryOptions = useMemo(() => buildCountryOptions(), []);
  const countryLabelMap = useMemo(
    () => new Map(countryOptions.map((option) => [option.code, option.label])),
    [countryOptions],
  );

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
      queryClient.invalidateQueries({ queryKey: ['waf', 'rule-groups'] }),
      queryClient.invalidateQueries({ queryKey: ['config-versions', 'diff'] }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: (payload: WAFRuleGroupPayload) => {
      if (selectedGroup) {
        return updateWAFRuleGroup(selectedGroup.id, payload);
      }
      return createWAFRuleGroup(payload);
    },
    onSuccess: async (group) => {
      setSelectedID(group.id);
      setFeedback({ tone: 'success', message: 'WAF 规则组已保存。' });
      await invalidate();
    },
    onError: (error) => {
      setFeedback({ tone: 'danger', message: getErrorMessage(error) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWAFRuleGroup,
    onSuccess: async () => {
      setSelectedID(null);
      setFeedback({ tone: 'success', message: 'WAF 规则组已删除。' });
      await invalidate();
    },
    onError: (error) => {
      setFeedback({ tone: 'danger', message: getErrorMessage(error) });
    },
  });

  const applyMutation = useMutation({
    mutationFn: ({ id, ids }: { id: number; ids: number[] }) =>
      replaceWAFRuleGroupSites(id, ids),
    onSuccess: async () => {
      setApplyGroup(null);
      setFeedback({ tone: 'success', message: '规则组应用范围已更新。' });
      await invalidate();
    },
    onError: (error) => {
      setFeedback({ tone: 'danger', message: getErrorMessage(error) });
    },
  });

  if (groupsQuery.isLoading || routesQuery.isLoading) {
    return <LoadingState />;
  }
  if (groupsQuery.isError) {
    return (
      <ErrorState
        title="WAF 加载失败"
        description={getErrorMessage(groupsQuery.error)}
      />
    );
  }
  if (routesQuery.isError) {
    return (
      <ErrorState
        title="网站列表加载失败"
        description={getErrorMessage(routesQuery.error)}
      />
    );
  }
  if (!selectedGroup && groups.length === 0) {
    return (
      <EmptyState
        title="WAF 尚未初始化"
        description="刷新页面后系统会自动创建全局规则组。"
      />
    );
  }

  const enabledGroups = groups.filter((group) => group.enabled);
  const protectedSites = new Set(
    groups.flatMap((group) => group.applied_site_ids),
  );
  const totalRules = groups.reduce(
    (sum, group) => sum + countRuleEntries(group),
    0,
  );
  const currentRuleCount = countRuleEntries(draft);
  const appliedSiteNames = selectedGroup?.is_global
    ? ['全部网站']
    : (selectedGroup?.applied_site_ids ?? [])
        .map(
          (id) =>
            routes.find((route) => route.id === id)?.site_name ?? `网站 #${id}`,
        )
        .sort((left, right) => left.localeCompare(right));

  const openRuleModal = () => {
    setRuleModal({ ...defaultRuleModalState, open: true });
  };

  const closeRuleModal = () => {
    setRuleModal(defaultRuleModalState);
  };

  const applyRuleModal = () => {
    const values =
      ruleModal.dimension === 'ip'
        ? textToList(ruleModal.ipValue)
        : normalizeItems(ruleModal.countryValues);

    if (values.length === 0) {
      setFeedback({
        tone: 'danger',
        message:
          ruleModal.dimension === 'ip'
            ? '请先输入 IP 或 IP 段。'
            : '请先选择地域。',
      });
      return;
    }

    const listKey = getListFieldKey(ruleModal.listType, ruleModal.dimension);
    setDraft((current) =>
      updateDraftList(current, listKey, (items) =>
        normalizeItems([...items, ...values]),
      ),
    );
    setFeedback({
      tone: 'info',
      message: '名单项已添加到当前草稿，保存后生效。',
    });
    closeRuleModal();
    setActiveTab('lists');
  };

  const removeRuleItem = (key: ListFieldKey, value: string) => {
    setDraft((current) =>
      updateDraftList(current, key, (items) =>
        items.filter((item) => item !== value),
      ),
    );
  };

  const overviewItems: Array<{ label: string; value: ReactNode }> = [
    {
      label: '当前规则组',
      value: selectedGroup ? selectedGroup.name : '新建规则组',
    },
    { label: '启用状态', value: draft.enabled ? '启用中' : '已停用' },
    { label: '当前规则数', value: `${currentRuleCount} 条` },
    {
      label: '生效范围',
      value: selectedGroup?.is_global
        ? '全部网站'
        : `${selectedGroup?.applied_site_count ?? 0} 个网站`,
    },
    {
      label: '拦截返回',
      value: draft.block_response_body.trim()
        ? `${draft.block_status_code} + 自定义页面`
        : `${draft.block_status_code} 状态码`,
    },
    {
      label: '最后更新',
      value: selectedGroup?.updated_at
        ? new Date(selectedGroup.updated_at).toLocaleString('zh-CN')
        : '未保存',
    },
  ];

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="WAF"
          description="按规则组维护 IP 与地域黑白名单，全局规则始终应用到所有网站。"
          action={
            <PrimaryButton
              type="button"
              onClick={() => {
                setSelectedID(0);
                setActiveTab('basic');
                setDraft({ ...emptyDraft, name: '自定义规则组' });
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              新建规则组
            </PrimaryButton>
          }
        />

        {feedback ? (
          <InlineMessage tone={feedback.tone} message={feedback.message} />
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <AppCard title="规则组">
            <div className="space-y-2">
              {groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => {
                    setSelectedID(group.id);
                    setActiveTab('basic');
                  }}
                  className={cn(
                    'w-full rounded-2xl border px-4 py-3 text-left transition',
                    selectedGroup?.id === group.id
                      ? 'border-[var(--border-strong)] bg-[var(--accent-soft)]'
                      : 'border-[var(--border-default)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-muted)]',
                  )}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      {group.is_global ? (
                        <Globe2 className="h-4 w-4" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                      <span className="truncate text-sm font-semibold text-[var(--foreground-primary)]">
                        {group.name}
                      </span>
                    </span>
                    <span className="text-xs text-[var(--foreground-secondary)]">
                      {group.enabled ? '启用' : '停用'}
                    </span>
                  </span>
                  <span className="mt-2 block text-xs text-[var(--foreground-secondary)]">
                    {group.is_global
                      ? '应用全部网站'
                      : `已应用 ${group.applied_site_count} 个网站`}{' '}
                    · {countRuleEntries(group)} 条规则
                  </span>
                </button>
              ))}
            </div>
          </AppCard>

          <AppCard
            title={selectedGroup ? selectedGroup.name : '新建规则组'}
            description="简介：白名单命中后直接放行；未命中白名单时继续判断黑名单。"
            action={
              <div className="flex flex-wrap gap-3">
                {selectedGroup && !selectedGroup.is_global ? (
                  <SecondaryButton
                    type="button"
                    onClick={() => setApplyGroup(selectedGroup)}
                  >
                    一键应用
                  </SecondaryButton>
                ) : null}
                <PrimaryButton
                  type="button"
                  disabled={saveMutation.isPending}
                  onClick={() => saveMutation.mutate(draft)}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saveMutation.isPending ? '保存中...' : '保存规则组'}
                </PrimaryButton>
              </div>
            }
          >
            <div className="space-y-6">
              <div className="grid gap-3 md:grid-cols-3">
                {tabItems.map((tab) => (
                  <TabButton
                    key={tab.id}
                    label={tab.label}
                    active={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                  />
                ))}
              </div>

              {activeTab === 'basic' ? (
                <div className="space-y-5">
                  <div className="grid gap-5 xl:grid-cols-2">
                    <ResourceField label="规则组名称">
                      <ResourceInput
                        value={draft.name}
                        disabled={selectedGroup?.is_global}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                      />
                    </ResourceField>
                    <ToggleField
                      label="启用规则组"
                      description="关闭后保留配置，但不会参与匹配。"
                      checked={draft.enabled}
                      onChange={(checked) =>
                        setDraft((current) => ({
                          ...current,
                          enabled: checked,
                        }))
                      }
                    />
                    <ResourceField
                      label="备注"
                      className="xl:col-span-2"
                      hint="用于记录规则组用途、业务说明或变更备注。"
                    >
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
                  <div className="grid gap-5">
                    <div className="space-y-5">
                      <div className="rounded-[26px] border border-[var(--border-default)] bg-[var(--surface-elevated)] p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-sm font-semibold text-[var(--foreground-primary)]">
                              配置总览
                            </h3>
                          </div>
                          <span className="rounded-full border border-[var(--border-default)] px-2.5 py-1 text-xs font-medium text-[var(--foreground-secondary)]">
                            {selectedGroup?.is_global ? '全局' : '自定义'}
                          </span>
                        </div>

                        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                          {overviewItems.map((item) => (
                            <div
                              key={item.label}
                              className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-panel)] px-4 py-4"
                            >
                              <dt className="text-xs font-medium tracking-[0.18em] text-[var(--foreground-muted)] uppercase">
                                {item.label}
                              </dt>
                              <dd className="mt-2 text-sm font-medium text-[var(--foreground-primary)]">
                                {item.value}
                              </dd>
                            </div>
                          ))}
                        </dl>

                        <div className="mt-5">
                          <p className="text-xs font-medium tracking-[0.18em] text-[var(--foreground-muted)] uppercase">
                            当前应用网站
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {appliedSiteNames.length > 0 ? (
                              appliedSiteNames.map((name) => (
                                <span
                                  key={name}
                                  className="rounded-full border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-2 text-sm text-[var(--foreground-secondary)]"
                                >
                                  {name}
                                </span>
                              ))
                            ) : (
                              <span className="rounded-2xl border border-dashed border-[var(--border-default)] px-4 py-3 text-sm text-[var(--foreground-secondary)]">
                                尚未绑定网站，可点击右上角「一键应用」进行配置。
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === 'lists' ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--foreground-primary)]">
                        黑白名单规则
                      </h3>
                    </div>
                    <PrimaryButton type="button" onClick={openRuleModal}>
                      <Plus className="mr-2 h-4 w-4" />
                      添加
                    </PrimaryButton>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <RuleListSection
                      title="IP 白名单"
                      description="命中后直接放行，不再继续判断黑名单。"
                      items={draft.ip_whitelist}
                      tone="whitelist"
                      emptyText="暂无 IP 白名单规则。"
                      onRemove={(item) => removeRuleItem('ip_whitelist', item)}
                    />
                    <RuleListSection
                      title="IP 黑名单"
                      description="未命中白名单时，命中这些 IP / IP 段将被拦截。"
                      items={draft.ip_blacklist}
                      tone="blacklist"
                      emptyText="暂无 IP 黑名单规则。"
                      onRemove={(item) => removeRuleItem('ip_blacklist', item)}
                    />
                    <RuleListSection
                      title="地域白名单"
                      description="显示格式为国家代码与中文名，命中后直接放行。"
                      items={draft.country_whitelist.map((code) =>
                        formatCountryItem(code, countryLabelMap),
                      )}
                      tone="whitelist"
                      emptyText="暂无地域白名单规则。"
                      onRemove={(item) => {
                        const code = item.split(' ')[0] ?? item;
                        removeRuleItem('country_whitelist', code);
                      }}
                    />
                    <RuleListSection
                      title="地域黑名单"
                      description="当请求未命中白名单时，命中这些地域将被拦截。"
                      items={draft.country_blacklist.map((code) =>
                        formatCountryItem(code, countryLabelMap),
                      )}
                      tone="blacklist"
                      emptyText="暂无地域黑名单规则。"
                      onRemove={(item) => {
                        const code = item.split(' ')[0] ?? item;
                        removeRuleItem('country_blacklist', code);
                      }}
                    />
                  </div>
                </div>
              ) : null}

              {activeTab === 'block' ? (
                <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
                  <div className="space-y-5">
                    <div className="rounded-[26px] border border-[var(--border-default)] bg-[var(--surface-elevated)] p-5">
                      <h3 className="text-sm font-semibold text-[var(--foreground-primary)]">
                        拦截返回状态码
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-[var(--foreground-secondary)]">
                        建议使用 403、418、451 等明确表达策略拦截含义的状态码。
                      </p>
                      <div className="mt-4 space-y-4">
                        <ResourceField label="状态码">
                          <ResourceInput
                            type="number"
                            min={400}
                            max={599}
                            value={draft.block_status_code}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                block_status_code: Number(event.target.value),
                              }))
                            }
                          />
                        </ResourceField>
                        <div className="flex flex-wrap gap-2">
                          {[403, 418, 451, 503].map((code) => (
                            <button
                              key={code}
                              type="button"
                              onClick={() =>
                                setDraft((current) => ({
                                  ...current,
                                  block_status_code: code,
                                }))
                              }
                              className={cn(
                                'rounded-full border px-3 py-2 text-sm transition',
                                draft.block_status_code === code
                                  ? 'border-[var(--border-strong)] bg-[var(--accent-soft)] text-[var(--foreground-primary)]'
                                  : 'border-[var(--border-default)] bg-[var(--surface-panel)] text-[var(--foreground-secondary)] hover:bg-[var(--surface-muted)]',
                              )}
                            >
                              {code}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[26px] border border-[var(--border-default)] bg-[var(--surface-elevated)] p-5">
                    <ResourceField
                      label="拦截页面"
                      hint="支持直接输入 HTML 或纯文本。留空时只返回状态码。"
                    >
                      <ResourceTextarea
                        value={draft.block_response_body}
                        className="min-h-72"
                        placeholder="<html><body><h1>Request blocked</h1></body></html>"
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            block_response_body: event.target.value,
                          }))
                        }
                      />
                    </ResourceField>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap justify-between gap-3 border-t border-[var(--border-default)] pt-6">
                <div>
                  {selectedGroup && !selectedGroup.is_global ? (
                    <DangerButton
                      type="button"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `确认删除 WAF 规则组 ${selectedGroup.name} 吗？`,
                          )
                        ) {
                          deleteMutation.mutate(selectedGroup.id);
                        }
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      删除
                    </DangerButton>
                  ) : null}
                </div>
              </div>
            </div>
          </AppCard>
        </div>
      </div>

      <RuleEntryModal
        state={ruleModal}
        countryOptions={countryOptions}
        pending={saveMutation.isPending}
        onClose={closeRuleModal}
        onChange={(patch) =>
          setRuleModal((current) => ({ ...current, ...patch, open: true }))
        }
        onSubmit={applyRuleModal}
      />

      <SiteApplyDrawer
        group={applyGroup}
        routes={routes}
        open={Boolean(applyGroup)}
        pending={applyMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setApplyGroup(null);
          }
        }}
        onSave={(ids) => {
          if (applyGroup) {
            applyMutation.mutate({ id: applyGroup.id, ids });
          }
        }}
      />
    </>
  );
}
