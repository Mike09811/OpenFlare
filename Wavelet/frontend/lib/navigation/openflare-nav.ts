import type {LucideIcon} from 'lucide-react';
import {
  ClipboardList,
  FileText,
  Gauge,
  GitBranch,
  Globe,
  Info,
  LayoutDashboard,
  MapPin,
  Route,
  ScrollText,
  Server,
  Shield,
} from 'lucide-react';

export interface OpenFlareNavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  /** 子页面在侧栏中仍高亮父级菜单项 */
  childUrls?: string[];
}

/** OpenFlare 业务控制台侧栏导航（子页面通过父级入口或页内链接访问） */
export const openflareNavItems: OpenFlareNavItem[] = [
  {title: '总览', url: '/openflare', icon: LayoutDashboard},
  {title: '节点', url: '/openflare/nodes', icon: Server, childUrls: ['/openflare/nodes/detail']},
  {title: '规则', url: '/openflare/proxy-routes', icon: Route, childUrls: ['/openflare/proxy-routes/detail']},
  {title: 'Pages', url: '/openflare/pages', icon: FileText, childUrls: ['/openflare/pages/detail']},
  {
    title: '网站',
    url: '/openflare/websites',
    icon: Globe,
    childUrls: [
      '/openflare/websites/detail',
      '/openflare/websites/certificates',
      '/openflare/websites/dns-accounts',
    ],
  },
  {title: 'WAF', url: '/openflare/waf', icon: Shield, childUrls: ['/openflare/waf/ip-groups']},
  {title: '源站', url: '/openflare/origins', icon: MapPin, childUrls: ['/openflare/origins/detail']},
  {title: '发布', url: '/openflare/config-versions', icon: GitBranch},
  {title: '访问日志', url: '/openflare/access-logs', icon: ScrollText},
  {title: '应用日志', url: '/openflare/apply-logs', icon: ClipboardList},
  {title: '性能', url: '/openflare/performance', icon: Gauge},
  {title: '关于', url: '/openflare/about', icon: Info},
];

/** 网站模块页内二级导航 */
export const openflareWebsiteSubNav = [
  {title: '网站列表', url: '/openflare/websites'},
  {title: '证书', url: '/openflare/websites/certificates'},
  {title: 'DNS 账号', url: '/openflare/websites/dns-accounts'},
] as const;