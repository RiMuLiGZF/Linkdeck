// 设置 / 自启 / 数据导入导出命令封装（spec 第 5 节）。
import { invoke } from './tauri';
import type { Settings } from '../types/models';

export const settingsGet = (): Promise<Settings> =>
  invoke<Settings>('settings_get', {});

export const settingsSet = (settings: Settings): Promise<void> =>
  invoke<void>('settings_set', settings);

export const autostartEnable = (): Promise<void> =>
  invoke<void>('autostart_enable', {});

export const autostartDisable = (): Promise<void> =>
  invoke<void>('autostart_disable', {});

export const autostartIsEnabled = (): Promise<boolean> =>
  invoke<boolean>('autostart_is_enabled', {});

/**
 * 导入备份 JSON（设置对话框「导入 JSON」）。
 * 后端 commands/data.rs 宽松解析三种形态：完整备份 {categories,links}、{links}、裸数组。
 * 归类优先级：categoryName > 备份内 id 映射 > 同库既有 id > 未分类；重复 URL 计入 skipped。
 */
export const importJson = (path: string): Promise<{ imported: number; skipped: number }> =>
  invoke<{ imported: number; skipped: number }>('import_json', { path });
