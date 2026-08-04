// 空状态（DESIGN-PAGES §5）。总空态（无数据）与无匹配态（搜索过滤为空）二合一。
import { Icon } from './Icon';

export interface EmptyStateProps {
  query: string;
  onClearSearch: () => void;
  onAdd: () => void;
  onImport: () => void;
}

export function EmptyState({ query, onClearSearch, onAdd, onImport }: EmptyStateProps) {
  if (query) {
    // 无匹配态
    return (
      <div className="empty empty--nomatch">
        <p className="empty__nomatch-text">没有匹配的网址</p>
        <button type="button" className="ghost-btn" onClick={onClearSearch}>
          清除搜索
        </button>
      </div>
    );
  }

  // 总空态
  return (
    <div className="empty">
      <Icon name="bookmark" size={24} className="empty__icon" />
      <h3 className="empty__title">还没有网址</h3>
      <p className="empty__desc">添加一个网址，或导入浏览器书签开始整理。</p>
      <div className="empty__actions">
        <button type="button" className="btn btn--primary" onClick={onAdd}>
          <Icon name="plus" size={20} />
          <span>添加第一个网址</span>
        </button>
        <button type="button" className="btn btn--secondary" onClick={onImport}>
          <Icon name="upload" size={20} />
          <span>导入书签</span>
        </button>
      </div>
    </div>
  );
}
