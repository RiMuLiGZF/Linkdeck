// 唯一图标出口：封装 lucide-react，禁止 emoji。
// 仅暴露设计规约实际用到的图标，尺寸严格三档 16 / 20 / 24（DESIGN-PAGES §0.2）。
import { type ComponentType } from 'react';
import { type LucideProps } from 'lucide-react';
import {
  Search,
  Settings,
  X,
  Folder,
  FolderOpen,
  ChevronDown,
  Plus,
  Upload,
  ExternalLink,
  Pencil,
  Copy,
  Trash2,
  Loader2,
  Globe,
  Bookmark,
  Keyboard,
  Download,
  Check,
  AlertTriangle,
} from 'lucide-react';

export type IconName =
  | 'search'
  | 'gear'
  | 'x'
  | 'folder'
  | 'folderOpen'
  | 'chevronDown'
  | 'plus'
  | 'upload'
  | 'externalLink'
  | 'pencil'
  | 'copy'
  | 'trash'
  | 'loader'
  | 'globe'
  | 'bookmark'
  | 'keyboard'
  | 'download'
  | 'check'
  | 'alertTriangle';

// 设计名 → Lucide 组件映射（gear 对应 Settings，trash 对应 Trash2，loader 对应 Loader2）。
const ICON_MAP: Record<IconName, ComponentType<LucideProps>> = {
  search: Search,
  gear: Settings,
  x: X,
  folder: Folder,
  folderOpen: FolderOpen,
  chevronDown: ChevronDown,
  plus: Plus,
  upload: Upload,
  externalLink: ExternalLink,
  pencil: Pencil,
  copy: Copy,
  trash: Trash2,
  loader: Loader2,
  globe: Globe,
  bookmark: Bookmark,
  keyboard: Keyboard,
  download: Download,
  check: Check,
  alertTriangle: AlertTriangle,
};

export interface IconProps {
  name: IconName;
  /** 16=行内/侧栏，20=按钮内/搜索框，24=独立图标 */
  size?: 16 | 20 | 24;
  className?: string;
  /** loader 旋转态 */
  spin?: boolean;
  strokeWidth?: number;
}

export function Icon({ name, size = 20, className, spin, strokeWidth = 2 }: IconProps) {
  const Cmp = ICON_MAP[name];
  const cls = [spin ? 'icon-spin' : '', className].filter(Boolean).join(' ');
  return <Cmp size={size} strokeWidth={strokeWidth} className={cls} aria-hidden="true" />;
}
