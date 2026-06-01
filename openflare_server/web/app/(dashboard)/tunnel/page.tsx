import type { Metadata } from 'next';

import { TunnelsPage } from '@/features/tunnels/components/tunnels-page';

export const metadata: Metadata = {
  title: '内网穿透 - OpenFlare',
};

export default function Page() {
  return <TunnelsPage />;
}
