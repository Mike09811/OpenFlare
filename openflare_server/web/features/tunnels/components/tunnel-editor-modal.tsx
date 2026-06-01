'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { AppModal } from '@/components/ui/app-modal';
import type { TunnelItem, TunnelMutationPayload } from '@/features/tunnels/types';
import {
  PrimaryButton,
  ResourceField,
  ResourceInput,
  SecondaryButton,
} from '@/features/shared/components/resource-primitives';

const tunnelEditorSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, '请输入隧道名称')
    .max(128, '隧道名称不能超过 128 个字符'),
  remark: z.string().trim().max(255, '备注不能超过 255 个字符').optional().default(''),
});

type TunnelEditorValues = z.infer<typeof tunnelEditorSchema>;

const defaultValues: TunnelEditorValues = {
  name: '',
  remark: '',
};

function buildFormValues(tunnel?: Partial<TunnelItem> | null): TunnelEditorValues {
  if (!tunnel) {
    return defaultValues;
  }

  return {
    name: tunnel.name ?? '',
    remark: tunnel.remark ?? '',
  };
}

export function TunnelEditorModal({
  isOpen,
  tunnel,
  isSubmitting,
  title,
  description,
  submitLabel,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  tunnel?: Partial<TunnelItem> | null;
  isSubmitting: boolean;
  title: string;
  description: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (payload: TunnelMutationPayload) => void;
}) {
  const form = useForm<TunnelEditorValues>({
    resolver: zodResolver(tunnelEditorSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    form.reset(buildFormValues(tunnel));
  }, [form, isOpen, tunnel]);

  const handleSubmit = form.handleSubmit((values) => {
    onSubmit({
      name: values.name.trim(),
      remark: values.remark.trim(),
    });
  });

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <SecondaryButton
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
          >
            取消
          </SecondaryButton>
          <PrimaryButton
            type="submit"
            form="tunnel-editor-form"
            disabled={isSubmitting}
          >
            {isSubmitting ? '保存中...' : submitLabel}
          </PrimaryButton>
        </div>
      }
    >
      <form id="tunnel-editor-form" className="space-y-5" onSubmit={handleSubmit}>
        <ResourceField
          label="隧道名称"
          hint="示例：home-nas-tunnel"
          error={form.formState.errors.name?.message}
        >
          <ResourceInput
            placeholder="home-nas-tunnel"
            {...form.register('name')}
          />
        </ResourceField>

        <ResourceField
          label="备注 (可选)"
          hint="用于描述该隧道的用途。"
          error={form.formState.errors.remark?.message}
        >
          <ResourceInput
            placeholder="家庭内网穿透"
            {...form.register('remark')}
          />
        </ResourceField>
      </form>
    </AppModal>
  );
}
