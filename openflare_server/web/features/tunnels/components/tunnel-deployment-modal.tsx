'use client';

import { AppModal } from '@/components/ui/app-modal';
import type { TunnelItem } from '@/features/tunnels/types';
import {
  CodeBlock,
  PrimaryButton,
} from '@/features/shared/components/resource-primitives';
import { useState, useEffect } from 'react';
import { getServerUrl } from '@/features/nodes/utils';

export function TunnelDeploymentModal({
  isOpen,
  tunnel,
  onClose,
}: {
  isOpen: boolean;
  tunnel?: TunnelItem | null;
  onClose: () => void;
}) {
  const [serverUrl, setServerUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && !serverUrl) {
      setServerUrl(window.location.origin);
    }
  }, [serverUrl]);

  if (!tunnel) {
    return null;
  }

  const normalizedServerUrl = getServerUrl(serverUrl);
  const image = 'ghcr.io/rain-kl/openflare-flared:latest';
  
  const dockerRunCmd = [
    `docker pull ${image}`,
    `docker rm -f openflare-flared 2>/dev/null || true`,
    `docker run -d --name openflare-flared --net host --restart unless-stopped \\`,
    `  -v /var/run/docker.sock:/var/run/docker.sock \\`,
    `  -v openflare_flared_data:/app/data \\`,
    `  -e OPENFLARE_SERVER_URL=${normalizedServerUrl} \\`,
    `  -e OPENFLARE_TUNNEL_TOKEN=${tunnel.tunnel_token} \\`,
    `  ${image}`,
  ].join('\n');

  const dockerComposeYaml = `version: '3.8'
services:
  openflare-flared:
    image: ${image}
    container_name: openflare-flared
    network_mode: "host"
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - openflare_flared_data:/app/data
    environment:
      - OPENFLARE_SERVER_URL=${normalizedServerUrl}
      - OPENFLARE_TUNNEL_TOKEN=${tunnel.tunnel_token}

volumes:
  openflare_flared_data:
`;

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="隧道客户端部署"
      description="请在需要穿透的内网服务器上部署 Flared 客户端。"
      footer={
        <div className="flex justify-end gap-3">
          <PrimaryButton type="button" onClick={onClose}>
            关闭
          </PrimaryButton>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--foreground-primary)]">
            方式一：Docker Run
          </p>
          <CodeBlock className="whitespace-pre-wrap">{dockerRunCmd}</CodeBlock>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--foreground-primary)]">
            方式二：Docker Compose (docker-compose.yml)
          </p>
          <CodeBlock className="whitespace-pre-wrap">{dockerComposeYaml}</CodeBlock>
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--foreground-primary)]">
            隧道 Token (仅供高级用法)
          </p>
          <p className="mt-1 break-all text-xs text-[var(--foreground-secondary)]">
            {tunnel.tunnel_token}
          </p>
        </div>
      </div>
    </AppModal>
  );
}
