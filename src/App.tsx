// 应用根：装配面板 + 模态，串联全局快捷键、窗口显隐、键盘导航与拖拽。
import { useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LauncherPanel } from './components/LauncherPanel';
import { AddUrlDialog } from './components/AddUrlDialog';
import { ImportDialog } from './components/ImportDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { CategoryManageDialog } from './components/CategoryManageDialog';
import { useUrlStore } from './stores/useUrlStore';
import { useSettingsStore } from './stores/useSettingsStore';
import { useGlobalShortcut } from './hooks/useGlobalShortcut';
import { useDragDrop } from './hooks/useDragDrop';
import { useDebouncedSearch } from './hooks/useDebouncedSearch';

export default function App() {
  const searchRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const visible = useUrlStore((s) => s.visible);
  const setVisible = useUrlStore((s) => s.setVisible);
  const query = useUrlStore((s) => s.query);
  const applyDebounced = useUrlStore((s) => s.applyDebounced);
  const move = useUrlStore((s) => s.move);
  const openSelected = useUrlStore((s) => s.openSelected);
  const activeModal = useUrlStore((s) => s.activeModal);
  const setPendingImportPath = useUrlStore((s) => s.setPendingImportPath);
  const openModal = useUrlStore((s) => s.openModal);
  const requestAddPrefill = useUrlStore((s) => s.requestAddPrefill);

  const hotkey = useSettingsStore((s) => s.settings.hotkey);

  // 初始化：加载分类/链接 + 设置
  useEffect(() => {
    void useUrlStore.getState().init();
    void useSettingsStore.getState().load();
  }, []);

  // 全局快捷键（注册/监听）
  useGlobalShortcut(hotkey, setVisible);

  // 搜索防抖 120ms
  useDebouncedSearch(query, 120, applyDebounced);

  // 拖拽双通道
  const dragging = useDragDrop({
    onHtmlPath: (path) => {
      setPendingImportPath(path);
      openModal('import');
    },
    onUrls: (urls) => {
      if (urls.length) requestAddPrefill(urls[0]);
    },
  });
  useEffect(() => setIsDragging(dragging), [dragging]);

  // 窗口显隐：visible 变化时 show/hide + 聚焦搜索框
  useEffect(() => {
    const w = getCurrentWindow();
    if (visible) {
      w.show()
        .then(() => w.setFocus())
        .catch(() => {});
      searchRef.current?.focus();
    } else {
      w.hide().catch(() => {});
    }
  }, [visible]);

  // 全局键盘导航（面板态、无模态时）
  useEffect(() => {
    if (!visible || activeModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setVisible(false);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        move(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        move(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        void openSelected();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, activeModal, setVisible, move, openSelected]);

  return (
    <div className="app-root">
      <LauncherPanel searchRef={searchRef} isDragging={isDragging} />
      {activeModal === 'add' && <AddUrlDialog onClose={closeModal} />}
      {activeModal === 'import' && <ImportDialog onClose={closeModal} />}
      {activeModal === 'settings' && <SettingsDialog onClose={closeModal} />}
      {activeModal === 'categories' && <CategoryManageDialog onClose={closeModal} />}
    </div>
  );

  function closeModal() {
    useUrlStore.getState().closeModal();
  }
}
