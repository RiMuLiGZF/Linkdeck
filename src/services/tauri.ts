// Tauri IPC 与插件封装。所有 invoke 命令名与 openapi.yaml operationId 完全一致。
import { invoke as tauriInvoke, convertFileSrc } from '@tauri-apps/api/core';
import { openUrl as pluginOpenUrl } from '@tauri-apps/plugin-opener';

/** 类型安全的 invoke 封装。 */
export function invoke<T>(command: string, args?: object): Promise<T> {
  return tauriInvoke<T>(command, (args ?? {}) as Record<string, unknown>);
}

/** 把 app_data_dir 下的本地文件（如 favicon png）转为 WebView 可加载的 asset:// URL。 */
export function toAssetUrl(path: string): string {
  return convertFileSrc(path);
}

/** 隐藏面板（关闭按钮 / Esc / 打开链接后调用；窗口操作统一由 Rust 端执行）。 */
export function panelHide(): Promise<void> {
  return invoke<void>('panel_hide', {});
}

/**
 * 用指定浏览器打开 URL（ADR-004：前端直连 opener 插件，无 Rust 中转）。
 * @param url   目标网址（仅 http/https，Rust capabilities 已限制 scheme）
 * @param app   指定浏览器；undefined = 系统默认
 */
export function openUrl(url: string, app?: string): Promise<void> {
  // plugin-opener 2.x: openWith 为字符串（浏览器名或自定义 exe 路径），非对象。
  return pluginOpenUrl(url, app);
}
