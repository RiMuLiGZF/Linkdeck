// 领域模型与命令参数类型。
// 字段名与 openapi.yaml / src-tauri/src/models.rs 对齐（Rust 用 serde camelCase，
// 故前端全部 camelCase：createdAt / categoryId / faviconPath）。

/** links 表一行。url 非空；categoryId 可空=未分类；faviconPath 可空。 */
export interface Url {
  id: string;
  title: string | null;
  url: string;
  categoryId: string | null;
  note: string | null;
  faviconPath: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

/** categories 表一行；count 由 categories_list 聚合，DB 无此列。 */
export interface Category {
  id: string;
  name: string;
  sort: number;
  color: string | null;
  icon: string | null;
  createdAt: string;
  count: number;
}

/**
 * 默认浏览器偏好。
 * - 'system'：系统默认（前端哨兵值，openUrl 时传 undefined）
 * - 'chrome' | 'msedge' | 'firefox'：探测到的浏览器
 * - 其它字符串：自定义 exe 绝对路径
 */
export type DefaultBrowser = 'system' | 'chrome' | 'msedge' | 'firefox' | (string & {});

export interface Settings {
  hotkey: string;
  defaultBrowser: DefaultBrowser;
  autostart: boolean;
  showOnStartup: boolean;
}

export interface ImportResult {
  imported: number;
  skipped: number;
}

export interface UrlMeta {
  title: string;
  faviconPath: string | null;
}

/** 拖拽 / 书签解析产出的草稿，待用户确认分类后写入 links。 */
export interface UrlDraft {
  url: string;
  title: string | null;
  categoryId: string | null;
}

// ---------- 命令入参（与 openapi.yaml components.schemas 对齐） ----------

export interface UrlsListArgs {
  categoryId?: string | null;
  search?: string | null;
  limit?: number;
  hasStartDate?: boolean;
}

export interface UrlCreateArgs {
  url: string;
  title?: string | null;
  categoryId?: string | null;
  note?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface UrlUpdateArgs {
  id: string;
  title?: string | null;
  categoryId?: string | null;
  note?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface CategoryCreateArgs {
  name: string;
  color?: string | null;
  icon?: string | null;
}

export interface CategoryUpdateArgs {
  id: string;
  name?: string | null;
  color?: string | null;
  icon?: string | null;
  sort?: number | null;
}

export interface CategoryReorderArgs {
  orderedIds: string[];
}

export interface BookmarksImportArgs {
  path: string;
}

export interface FetchMetaArgs {
  url: string;
}

export interface DragResolveArgs {
  items: string[];
}
