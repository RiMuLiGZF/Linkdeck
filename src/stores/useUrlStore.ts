// 链接 / 分类 / 面板状态的单一数据源（zustand）。
// 搜索采用「服务端按关键词拉取 + 前端按分类过滤」策略：先 urls_list(search) 取全量，
// 再在内存按 activeCategoryId 过滤（含 uncategorized = categoryId 为 null），
// 兼顾实时性与 uncategorized 这类无专属参数的场景。虚拟滚动在 UrlList 内处理。
import { create } from 'zustand';
import * as urlsSvc from '../services/urls';
import * as bookmarksSvc from '../services/bookmarks';
import { openUrl as openUrlSvc, invoke } from '../services/tauri';
import { useSettingsStore } from './useSettingsStore';
import type { Category, Url } from '../types/models';

export type ActiveCategory = 'all' | 'uncategorized' | string;
export type ModalKind = 'add' | 'import' | 'settings' | 'categories' | null;

const MAX_FETCH = 5000;

interface UrlStore {
  categories: Category[];
  urls: Url[];
  uncategorizedCount: number;
  activeCategoryId: ActiveCategory;
  query: string;
  debouncedQuery: string;
  selectedIndex: number;
  loading: boolean;
  error: string | null;
  visible: boolean;

  // 模态 / 拖拽 / 编辑上下文
  activeModal: ModalKind;
  editItem: Url | null;
  prefill: { url: string; title?: string } | null;
  pendingImportPath: string | null;

  init: () => Promise<void>;
  reload: () => Promise<void>;
  reloadCategories: () => Promise<void>;

  setQuery: (q: string) => void;
  applyDebounced: (q: string) => void;
  setActiveCategory: (id: ActiveCategory) => void;
  setSelectedIndex: (i: number) => void;
  move: (delta: number) => void;

  openSelected: () => Promise<void>;
  openItem: (item: Url) => Promise<void>;

  addUrl: (args: { url: string; title?: string | null; categoryId?: string | null }) => Promise<void>;
  updateUrl: (args: { id: string; title?: string | null; categoryId?: string | null; note?: string | null }) => Promise<void>;
  deleteUrl: (id: string) => Promise<void>;
  refreshMeta: (id: string) => Promise<void>;
  importBookmarks: (path: string) => Promise<{ imported: number; skipped: number }>;

  setVisible: (v: boolean) => void;
  toggleVisible: () => void;

  openModal: (k: Exclude<ModalKind, null>) => void;
  closeModal: () => void;
  requestEdit: (item: Url) => void;
  requestAddPrefill: (url: string) => void;
  setPendingImportPath: (p: string | null) => void;
}

function filterByCategory(list: Url[], id: ActiveCategory): Url[] {
  if (id === 'all') return list;
  if (id === 'uncategorized') return list.filter((u) => !u.categoryId);
  return list.filter((u) => u.categoryId === id);
}

function clampIndex(i: number, len: number): number {
  if (len === 0) return 0;
  return Math.max(0, Math.min(i, len - 1));
}

export const useUrlStore = create<UrlStore>((set, get) => ({
  categories: [],
  urls: [],
  uncategorizedCount: 0,
  activeCategoryId: 'all',
  query: '',
  debouncedQuery: '',
  selectedIndex: 0,
  loading: false,
  error: null,
  visible: false,

  activeModal: null,
  editItem: null,
  prefill: null,
  pendingImportPath: null,

  init: async () => {
    set({ loading: true, error: null });
    try {
      await Promise.all([get().reloadCategories(), get().reload()]);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '加载失败' });
    } finally {
      set({ loading: false });
    }
  },

  // 分类单独拉取（含计数），与链接列表解耦。
  reloadCategories: async () => {
    try {
      const list = await invoke<Category[]>('categories_list', {});
      set({ categories: list });
    } catch {
      /* 后端未就绪时保留空列表 */
    }
  },

  reload: async () => {
    const { activeCategoryId, debouncedQuery } = get();
    try {
      const list = await urlsSvc.urlsList({
        search: debouncedQuery || null,
        limit: MAX_FETCH,
      });
      // 无搜索时从全量数据计算未分类计数（有搜索时保留上次值）
      const isSearching = debouncedQuery.trim().length > 0;
      const uncategorizedCount = isSearching
        ? get().uncategorizedCount
        : list.filter((u) => !u.categoryId).length;
      const filtered = filterByCategory(list, activeCategoryId);
      set((s) => ({
        urls: filtered,
        uncategorizedCount,
        selectedIndex: clampIndex(s.selectedIndex, filtered.length),
      }));
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '刷新失败' });
    }
  },

  setQuery: (q) => set({ query: q }),

  applyDebounced: (q) => {
    set({ debouncedQuery: q, selectedIndex: 0 });
    void get().reload();
  },

  setActiveCategory: (id) => {
    set({ activeCategoryId: id, selectedIndex: 0 });
    void get().reload();
  },

  setSelectedIndex: (i) => {
    const len = get().urls.length;
    set({ selectedIndex: clampIndex(i, len) });
  },

  move: (delta) => {
    const { selectedIndex, urls } = get();
    set({ selectedIndex: clampIndex(selectedIndex + delta, urls.length) });
  },

  openItem: async (item) => {
    const browser = useSettingsStore.getState().settings.defaultBrowser;
    const app = browser && browser !== 'system' ? browser : undefined;
    await openUrlSvc(item.url, app);
    // 打开后隐藏面板（AC-05 / AC-02）。
    set({ visible: false });
  },

  openSelected: async () => {
    const { urls, selectedIndex } = get();
    const item = urls[selectedIndex];
    if (item) await get().openItem(item);
  },

  addUrl: async (args) => {
    await urlsSvc.urlCreate({
      url: args.url,
      title: args.title ?? null,
      categoryId: args.categoryId ?? null,
    });
    await get().reload();
    await get().reloadCategories();
  },

  updateUrl: async (args) => {
    await urlsSvc.urlUpdate({
      id: args.id,
      title: args.title ?? null,
      categoryId: args.categoryId ?? null,
      note: args.note ?? null,
    });
    await get().reload();
    await get().reloadCategories();
  },

  deleteUrl: async (id) => {
    await urlsSvc.urlDelete(id);
    await get().reload();
    await get().reloadCategories();
  },

  refreshMeta: async (id) => {
    await urlsSvc.urlRefreshMeta(id);
    await get().reload();
  },

  importBookmarks: async (path) => {
    const r = await bookmarksSvc.bookmarksImport(path);
    await get().reload();
    await get().reloadCategories();
    return r;
  },

  setVisible: (v) => set({ visible: v }),
  toggleVisible: () => set((s) => ({ visible: !s.visible })),

  openModal: (k) => set({ activeModal: k }),
  closeModal: () =>
    set({ activeModal: null, editItem: null, prefill: null, pendingImportPath: null }),

  requestEdit: (item) => set({ activeModal: 'add', editItem: item, prefill: null }),
  requestAddPrefill: (url) =>
    set({ activeModal: 'add', prefill: { url }, editItem: null }),
  setPendingImportPath: (p) => set({ pendingImportPath: p }),
}));
