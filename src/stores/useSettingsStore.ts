// 设置状态（hotkey / defaultBrowser / autostart）。
import { create } from 'zustand';
import * as settingsSvc from '../services/settings';
import type { Settings } from '../types/models';

const DEFAULT_SETTINGS: Settings = {
  hotkey: 'Alt+Space',
  defaultBrowser: 'system',
  autostart: false,
};

interface SettingsStore {
  settings: Settings;
  loaded: boolean;
  load: () => Promise<void>;
  save: (next: Settings) => Promise<void>;
  setAutostart: (on: boolean) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    try {
      const s = await settingsSvc.settingsGet();
      if (s) set({ settings: { ...DEFAULT_SETTINGS, ...s }, loaded: true });
      else set({ loaded: true });
    } catch {
      // 后端未就绪时退化为默认，避免白屏。
      set({ loaded: true });
    }
  },

  save: async (next) => {
    await settingsSvc.settingsSet(next);
    set({ settings: next });
  },

  setAutostart: async (on) => {
    if (on) await settingsSvc.autostartEnable();
    else await settingsSvc.autostartDisable();
  },
}));
