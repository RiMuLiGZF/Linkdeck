// 分类侧栏（DESIGN-PAGES §1.3）。首项「全部」+ 用户分类 + 「未分类」+ 「比赛」。
// 选中仅以背景 tint + 文字色表达，禁止彩色边条。
import { Icon } from './Icon';
import type { Category } from '../types/models';
import type { ActiveCategory, ActiveView } from '../stores/useUrlStore';

export interface CategorySidebarProps {
  categories: Category[];
  activeId: ActiveCategory;
  activeView: ActiveView;
  uncategorizedCount: number;
  competitionCount: number;
  onSelect: (id: ActiveCategory) => void;
  onViewChange: (v: ActiveView) => void;
  onManage: () => void;
}

interface Item {
  id: ActiveCategory;
  name: string;
  count: number;
  icon?: string | null;
}

export function CategorySidebar({ categories, activeId, activeView, uncategorizedCount, competitionCount, onSelect, onViewChange, onManage }: CategorySidebarProps) {
  const total = categories.reduce((sum, c) => sum + c.count, 0) + uncategorizedCount;

  const items: Item[] = [
    { id: 'all', name: '全部', count: total },
    ...categories
      .map((c) => ({ id: c.id, name: c.name, count: c.count, icon: c.icon })),
    { id: 'uncategorized', name: '未分类', count: uncategorizedCount },
  ];

  return (
    <nav className="sidebar" aria-label="分类">
      <div className="sidebar__items">
        {items.map((it) => {
          const selected = activeView === 'bookmarks' && it.id === activeId;
          return (
            <button
              key={it.id}
              type="button"
              className={`category-item${selected ? ' category-item--active' : ''}`}
              role="button"
              aria-pressed={selected}
              onClick={() => {
                onViewChange('bookmarks');
                onSelect(it.id);
              }}
            >
              <Icon name="folder" size={16} className="category-item__icon" />
              <span className="category-item__name">{it.name}</span>
              <span className="category-item__count">{it.count}</span>
            </button>
          );
        })}
      </div>

      <div className="sidebar__divider" />

      <div className="sidebar__items">
        <button
          type="button"
          className={`category-item${activeView === 'competitions' ? ' category-item--active' : ''}`}
          role="button"
          aria-pressed={activeView === 'competitions'}
          onClick={() => onViewChange('competitions')}
        >
          <Icon name="calendar" size={16} className="category-item__icon" />
          <span className="category-item__name">比赛</span>
          <span className="category-item__count">{competitionCount}</span>
        </button>
      </div>

      <button
        type="button"
        className="sidebar__manage-btn"
        aria-label="管理分类"
        onClick={onManage}
      >
        <Icon name="gear" size={16} />
        <span>管理分类</span>
      </button>
    </nav>
  );
}