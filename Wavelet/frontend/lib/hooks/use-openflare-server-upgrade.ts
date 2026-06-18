'use client';

import {useMutation, useQuery} from '@tanstack/react-query';
import {useCallback, useEffect, useRef, useState} from 'react';

import type {
  LatestReleaseInfo,
  ReleaseChannel,
  UpgradeStreamSnapshot,
  UploadedServerBinaryInfo,
} from '@/lib/services/openflare';
import {StatusService, UpdateService} from '@/lib/services/openflare';

const UPGRADE_STATUS_POLL_INTERVAL = 3000;

export const openflarePublicStatusQueryKey = ['openflare', 'public-status'] as const;

export const openflareLatestReleaseQueryKey = (channel: ReleaseChannel = 'stable') =>
  ['openflare', 'latest-release', channel] as const;

export function mergeReleaseWithUpgradeStream(
  release: LatestReleaseInfo | null | undefined,
  stream: UpgradeStreamSnapshot | null,
) {
  if (!release || !stream) {
    return release;
  }

  return {
    ...release,
    in_progress: stream.in_progress,
    upgrade_status: stream.upgrade_status,
    upgrade_logs: stream.upgrade_logs,
  };
}

export function useOpenFlareServerUpgrade({
  open,
  canUpgrade,
}: {
  open: boolean;
  canUpgrade: boolean;
}) {
  const [selectedChannel, setSelectedChannel] = useState<ReleaseChannel>('stable');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [manualStatusMessage, setManualStatusMessage] = useState<string | null>(null);
  const [manualErrorMessage, setManualErrorMessage] = useState<string | null>(null);
  const [uploadedBinary, setUploadedBinary] = useState<UploadedServerBinaryInfo | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [upgradeStream, setUpgradeStream] = useState<UpgradeStreamSnapshot | null>(null);

  const upgradeRefreshPendingRef = useRef(false);
  const upgradeReloadStartedRef = useRef(false);
  const upgradeReloadTimerRef = useRef<number | null>(null);

  const statusQuery = useQuery({
    queryKey: openflarePublicStatusQueryKey,
    queryFn: () => StatusService.getPublicStatus(),
    enabled: open,
  });

  const stableReleaseQuery = useQuery({
    queryKey: openflareLatestReleaseQueryKey('stable'),
    queryFn: () => UpdateService.getLatestRelease('stable'),
    enabled: open && canUpgrade,
    refetchInterval: (query) => {
      const release = query.state.data;
      if (open && release?.in_progress) {
        return UPGRADE_STATUS_POLL_INTERVAL;
      }
      return 60 * 60 * 1000;
    },
  });

  const previewReleaseQuery = useQuery({
    queryKey: openflareLatestReleaseQueryKey('preview'),
    queryFn: () => UpdateService.getLatestRelease('preview'),
    enabled: false,
    refetchInterval: (query) => {
      const release = query.state.data;
      if (open && release?.in_progress) {
        return UPGRADE_STATUS_POLL_INTERVAL;
      }
      return false;
    },
  });

  const scheduleUpgradePageReload = useCallback(() => {
    if (upgradeReloadStartedRef.current) {
      return;
    }

    upgradeReloadStartedRef.current = true;
    setFeedback('服务升级已进入重启阶段，页面将在服务恢复后自动刷新。');

    const reloadWhenServerReady = async () => {
      try {
        await StatusService.getPublicStatus();
        window.location.reload();
      } catch {
        upgradeReloadTimerRef.current = window.setTimeout(reloadWhenServerReady, 1500);
      }
    };

    upgradeReloadTimerRef.current = window.setTimeout(reloadWhenServerReady, 1200);
  }, []);

  useEffect(() => {
    return () => {
      if (upgradeReloadTimerRef.current !== null) {
        window.clearTimeout(upgradeReloadTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!open || !canUpgrade) {
      setUpgradeStream(null);
      return;
    }

    let closed = false;
    let reconnectTimer: number | null = null;
    let socket: WebSocket | null = null;

    const connect = () => {
      if (closed) {
        return;
      }

      socket = UpdateService.createUpgradeLogsWebSocket();
      if (!socket) {
        return;
      }

      socket.onmessage = (event) => {
        const snapshot = UpdateService.parseUpgradeStreamSnapshot(String(event.data));
        if (snapshot) {
          if (snapshot.in_progress || snapshot.upgrade_status === 'succeeded') {
            upgradeRefreshPendingRef.current = true;
          }
          if (snapshot.upgrade_status === 'failed') {
            upgradeRefreshPendingRef.current = false;
          }
          setUpgradeStream(snapshot);
        }
      };

      socket.onclose = () => {
        if (closed) {
          return;
        }
        if (upgradeRefreshPendingRef.current) {
          scheduleUpgradePageReload();
          return;
        }
        reconnectTimer = window.setTimeout(connect, 1500);
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      socket?.close();
    };
  }, [canUpgrade, open, scheduleUpgradePageReload]);

  const upgradeMutation = useMutation({
    mutationFn: (channel: ReleaseChannel) => UpdateService.upgradeServer(channel),
    onSuccess: (release) => {
      upgradeRefreshPendingRef.current = true;
      setUploadedBinary(null);
      setManualStatusMessage(null);
      setManualErrorMessage(null);
      setFeedback(
        `服务升级任务已启动，目标版本 ${release.tag_name}（${release.channel === 'preview' ? '预览版' : '正式版'}）。页面可能短暂不可用。`,
      );
      void stableReleaseQuery.refetch();
      if (release.channel === 'preview') {
        void previewReleaseQuery.refetch();
      }
    },
    onError: (error) => {
      setFeedback(error instanceof Error ? error.message : '升级失败，请稍后重试。');
    },
  });

  const uploadBinaryMutation = useMutation({
    mutationFn: (binary: File) =>
      UpdateService.uploadServerBinary(binary, (progress) => {
        setUploadProgress(progress);
      }),
    onSuccess: (candidate) => {
      setUploadProgress(0);
      setFeedback(null);
      setManualErrorMessage(null);
      setUploadedBinary(candidate);
      setManualStatusMessage(candidate.comparison_message);
    },
    onError: (error) => {
      setUploadProgress(0);
      setUploadedBinary(null);
      setManualStatusMessage(null);
      setManualErrorMessage(
        error instanceof Error ? error.message : '上传升级包失败，请稍后重试。',
      );
    },
  });

  const confirmManualUpgradeMutation = useMutation({
    mutationFn: (uploadToken: string) => UpdateService.confirmManualServerUpgrade(uploadToken),
    onSuccess: (candidate) => {
      upgradeRefreshPendingRef.current = true;
      setFeedback(null);
      setManualErrorMessage(null);
      setUploadedBinary(candidate);
      setManualStatusMessage(
        `手动升级任务已启动，目标版本 ${candidate.detected_version}。页面可能短暂不可用。`,
      );
      void stableReleaseQuery.refetch();
      void previewReleaseQuery.refetch();
    },
    onError: (error) => {
      setManualStatusMessage(null);
      setManualErrorMessage(
        error instanceof Error ? error.message : '确认手动升级失败，请稍后重试。',
      );
    },
  });

  const resetTransientState = useCallback(() => {
    setSelectedChannel('stable');
    setFeedback(null);
    setManualStatusMessage(null);
    setManualErrorMessage(null);
    setUploadedBinary(null);
    setUploadProgress(0);
    setUpgradeStream(null);
    upgradeRefreshPendingRef.current = false;
    upgradeReloadStartedRef.current = false;
  }, []);

  const handleOpen = useCallback(() => {
    resetTransientState();
    if (canUpgrade) {
      void stableReleaseQuery.refetch();
    }
  }, [canUpgrade, resetTransientState, stableReleaseQuery]);

  const handleCheckRelease = useCallback(() => {
    setFeedback(null);
    if (!canUpgrade) {
      return;
    }
    if (selectedChannel === 'preview') {
      void previewReleaseQuery.refetch();
      return;
    }
    void stableReleaseQuery.refetch();
  }, [canUpgrade, previewReleaseQuery, selectedChannel, stableReleaseQuery]);

  const handleChannelChange = useCallback((channel: ReleaseChannel) => {
    setSelectedChannel(channel);
    setFeedback(null);
  }, []);

  const handleUpgrade = useCallback(() => {
    setFeedback(null);
    setManualStatusMessage(null);
    setManualErrorMessage(null);
    upgradeMutation.mutate(selectedChannel);
  }, [selectedChannel, upgradeMutation]);

  const handleUploadBinary = useCallback(
    (binary: File) => {
      setUploadProgress(0);
      setManualStatusMessage(null);
      setManualErrorMessage(null);
      uploadBinaryMutation.mutate(binary);
    },
    [uploadBinaryMutation],
  );

  const handleConfirmManualUpgrade = useCallback(() => {
    if (!uploadedBinary?.upload_token) {
      setManualStatusMessage(null);
      setManualErrorMessage('请先上传并检查升级包。');
      return;
    }
    setFeedback(null);
    setManualStatusMessage(null);
    setManualErrorMessage(null);
    confirmManualUpgradeMutation.mutate(uploadedBinary.upload_token);
  }, [confirmManualUpgradeMutation, uploadedBinary?.upload_token]);

  const selectedRelease =
    selectedChannel === 'preview' ? previewReleaseQuery.data : stableReleaseQuery.data;
  const releaseWithStream = mergeReleaseWithUpgradeStream(selectedRelease, upgradeStream);
  const selectedReleaseError =
    selectedChannel === 'preview' ? previewReleaseQuery.error : stableReleaseQuery.error;
  const isSelectedReleaseError =
    selectedChannel === 'preview' ? previewReleaseQuery.isError : stableReleaseQuery.isError;
  const isChecking =
    selectedChannel === 'preview'
      ? previewReleaseQuery.isFetching
      : stableReleaseQuery.isFetching;
  const isInitialLoading =
    (selectedChannel === 'preview'
      ? previewReleaseQuery.isLoading && !previewReleaseQuery.data
      : stableReleaseQuery.isLoading && !stableReleaseQuery.data) && canUpgrade;

  const releaseErrorMessage =
    feedback ||
    (isSelectedReleaseError
      ? selectedReleaseError instanceof Error
        ? selectedReleaseError.message
        : '版本检查失败，请稍后重试。'
      : undefined);

  const currentVersion = statusQuery.data?.version || releaseWithStream?.current_version || 'unknown';

  return {
    currentVersion,
    selectedChannel,
    release: releaseWithStream,
    uploadedBinary,
    releaseErrorMessage,
    manualStatusMessage,
    manualErrorMessage,
    isInitialLoading,
    isChecking,
    isUpgrading: upgradeMutation.isPending,
    isUploadingBinary: uploadBinaryMutation.isPending,
    uploadProgress,
    isConfirmingManualUpgrade: confirmManualUpgradeMutation.isPending,
    stableRelease: stableReleaseQuery.data,
    handleOpen,
    handleCheckRelease,
    handleChannelChange,
    handleUpgrade,
    handleUploadBinary,
    handleConfirmManualUpgrade,
  };
}