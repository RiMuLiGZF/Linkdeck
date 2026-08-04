// 浮窗容器（DESIGN-PAGES §1）。组装 Header / Body(Sidebar+List) / Footer + 拖入遮罩。
// 直接消费 useUrlStore，避免 prop 透传；searchRef 与 isDragging 由 App 提供。
import { type RefObject } from 'react';
import { confirm } from '@tauri-apps/plugin-dialog';
import { Icon } from './Icon';
import { SearchBar } from './SearchBar';
import { CategorySidebar } from './CategorySidebar';
import { UrlList } from './UrlList';
import { FooterAddBar } from './FooterAddBar';
import { useUrlStore } from '../stores/useUrlStore';
import type { Url } from '../types/models';

export interface LauncherPanelProps {
  searchRef: RefObject<HTMLInputElement>;
  isDragging: boolean;
}

export function LauncherPanel({ searchRef, isDragging }: LauncherPanelProps) {
  const categories = useUrlStore((s) => s.categories);
  const urls = useUrlStore((s) => s.urls);
  const activeCategoryId = useUrlStore((s) => s.activeCategoryId);
  const query = useUrlStore((s) => s.query);
  const selectedIndex = useUrlStore((s) => s.selectedIndex);
  const uncategorizedCount = useUrlStore((s) => s.uncategorizedCount);

  const setQuery = useUrlStore((s) => s.setQuery);
  const applyDebounced = useUrlStore((s) => s.applyDebounced);
  const setActiveCategory = useUrlStore((s) => s.setActiveCategory);
  const setSelectedIndex = useUrlStore((s) => s.setSelectedIndex);
  const openItem = useUrlStore((s) => s.openItem);
  const requestEdit = useUrlStore((s) => s.requestEdit);
  const requestAddPrefill = useUrlStore((s) => s.requestAddPrefill);
  const deleteUrl = useUrlStore((s) => s.deleteUrl);
  const openModal = useUrlStore((s) => s.openModal);
  const setVisible = useUrlStore((s) => s.setVisible);

  const handleCopy = (url: string) => {
    navigator.clipboard?.writeText(url).catch(() => {});
  };

  const clearSearch = () => {
    setQuery('');
    applyDebounced('');
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm('确定要删除这个网址吗？', { title: '删除确认', kind: 'warning' });
    if (confirmed) {
      await deleteUrl(id);
    }
  };

  return (
    <section className="panel" aria-label="网址板">
      <header className="panel__header" data-tauri-drag-region>
        <SearchBar ref={searchRef} value={query} onChange={setQuery} />
        <button
          type="button"
          className="icon-btn"
          aria-label="设置"
          onClick={() => openModal('settings')}
        >
          <Icon name="gear" size={20} />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="关闭"
          onClick={() => setVisible(false)}
        >
          <Icon name="x" size={20} />
        </button>
      </header>

      <div className="panel__body">
        <CategorySidebar
          categories={categories}
          activeId={activeCategoryId}
          uncategorizedCount={uncategorizedCount}
          onSelect={setActiveCategory}
          onManage={() => openModal('categories')}
        />
        <UrlList
          urls={urls}
          categories={categories}
          selectedIndex={selectedIndex}
          query={query}
          onOpen={(item: Url) => openItem(item)}
          onSelect={setSelectedIndex}
          onEdit={(item) => requestEdit(item)}
          onCopy={handleCopy}
          onDelete={handleDelete}
          onClearSearch={clearSearch}
          onAdd={() => openModal('add')}
          onImport={() => openModal('import')}
          onAddWithQuery={(q) => requestAddPrefill(q)}
        />
      </div>

      <FooterAddBar onAdd={() => openModal('add')} onImport={() => openModal('import')} />

      {isDragging && (
        <div className="panel__drop-overlay" aria-hidden="true">
          <span className="panel__drop-text">松开以添加网址</span>
        </div>
      )}
    </section>
  );
}
