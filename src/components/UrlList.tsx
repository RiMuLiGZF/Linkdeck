// 网址列表（DESIGN-PAGES §1.4）+ 虚拟滚动（@tanstack/react-virtual，应对上千条）。
// 空数据 → EmptyState；有数据但过滤为空 → 无匹配态。键盘选中项自动滚入视野。
import { useEffect, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { UrlRow } from './UrlRow';
import { EmptyState } from './EmptyState';
import type { Category, Url } from '../types/models';

export interface UrlListProps {
  urls: Url[];
  categories: Category[];
  selectedIndex: number;
  query: string;
  onOpen: (item: Url) => void;
  onSelect: (index: number) => void;
  onEdit: (item: Url) => void;
  onCopy: (url: string) => void;
  onDelete: (id: string) => void;
  onClearSearch: () => void;
  onAdd: () => void;
  onImport: () => void;
}

const ROW_HEIGHT = 44;

export function UrlList({
  urls,
  categories,
  selectedIndex,
  query,
  onOpen,
  onSelect,
  onEdit,
  onCopy,
  onDelete,
  onClearSearch,
  onAdd,
  onImport,
}: UrlListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const nameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.id, c.name);
    m.set('__uncategorized__', '未分类');
    return m;
  }, [categories]);

  const virtualizer = useVirtualizer({
    count: urls.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  useEffect(() => {
    if (urls.length > 0) {
      virtualizer.scrollToIndex(Math.max(0, selectedIndex), { align: 'auto' });
    }
  }, [selectedIndex, urls.length, virtualizer]);

  if (urls.length === 0) {
    return (
      <div className="url-list url-list--empty">
        <EmptyState query={query} onClearSearch={onClearSearch} onAdd={onAdd} onImport={onImport} />
      </div>
    );
  }

  return (
    <div className="url-list" ref={parentRef} role="listbox" aria-label="网址列表" tabIndex={-1}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((vi) => {
          const item = urls[vi.index];
          return (
            <div
              key={item.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: ROW_HEIGHT,
                transform: `translateY(${vi.start}px)`,
              }}
            >
              <UrlRow
                item={item}
                selected={vi.index === selectedIndex}
                categoryName={item.categoryId ? nameMap.get(item.categoryId) ?? null : '未分类'}
                onOpen={() => onOpen(item)}
                onSelect={() => onSelect(vi.index)}
                onEdit={() => onEdit(item)}
                onCopy={() => onCopy(item.url)}
                onDelete={() => onDelete(item.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
