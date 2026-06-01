export interface TunnelItem {
  id: number;
  tunnel_id: string;
  name: string;
  tunnel_token: string;
  status: 'online' | 'offline';
  client_version: string;
  frp_version: string;
  last_seen_at?: string | null;
  last_error: string;
  current_version: string;
  current_checksum: string;
  connected_relays: string[];
  remark: string;
  created_at: string;
  updated_at: string;
}

export interface TunnelMutationPayload {
  name: string;
  remark: string;
}
