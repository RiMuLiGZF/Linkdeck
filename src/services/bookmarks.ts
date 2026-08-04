// 书签导入 / 拖拽解析命令封装（spec 第 5、11 节）。
import { invoke } from './tauri';
import type { ImportResult, UrlDraft } from '../types/models';

/** 解析 Netscape 书签 HTML 并批量入库去重。 */
export const bookmarksImport = (path: string): Promise<ImportResult> =>
  invoke<ImportResult>('bookmarks_import', { path });

/**
 * 拖拽双通道桥接（spec 第 11 节坑）：前端 HTML5 drop 取到 text/uri-list 后，
 * 交给 Rust 解析为 UrlDraft 列表。通道 A（文件路径）由 Rust 窗口事件直接处理。
 */
export const dragResolve = (items: string[]): Promise<UrlDraft[]> =>
  invoke<UrlDraft[]>('drag_resolve', { items });
