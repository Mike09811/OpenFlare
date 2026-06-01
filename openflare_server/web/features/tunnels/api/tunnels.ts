import { apiRequest } from '@/lib/api/client';

import type { TunnelItem, TunnelMutationPayload } from '@/features/tunnels/types';

export function getTunnels() {
  return apiRequest<TunnelItem[]>('/tunnels/');
}

export function createTunnel(payload: TunnelMutationPayload) {
  return apiRequest<TunnelItem>('/tunnels/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateTunnel(id: number, payload: TunnelMutationPayload) {
  return apiRequest<TunnelItem>(`/tunnels/${id}/update`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteTunnel(id: number) {
  return apiRequest<void>(`/tunnels/${id}/delete`, {
    method: 'POST',
  });
}

export function rotateTunnelToken(id: number) {
  return apiRequest<TunnelItem>(`/tunnels/${id}/rotate-token`, {
    method: 'POST',
  });
}
