// 设置（DESIGN-PAGES §4）。快捷键录制（对齐 shortcut.rs 拒绝清单）、浏览器选择、
// 开机自启开关、数据 JSON 导入导出。
import { useEffect, useState } from 'react';
import { open, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { Modal } from './Modal';
import { Icon } from './Icon';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useUrlStore } from '../stores/useUrlStore';
import { urlsList } from '../services/urls';
import { importJson } from '../services/settings';
import { validateShortcut, type ShortcutCheck } from '../lib/shortcut';
import type { Settings } from '../types/models';

type BrowserMode = 'system' | 'chrome' | 'msedge' | 'firefox' | 'custom';

function codeToToken(code: string): string | null {
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return letter[1];
  const digit = /^Digit([0-9])$/.exec(code);
  if (digit) return digit[1];
  const f = /^F([0-9]{1,2})$/.exec(code);
  if (f) return `F${f[1]}`;
  const map: Record<string, string> = {
    Space: 'Space', Enter: 'Enter', Comma: ',', Period: '.', Slash: '/',
    Backslash: '\\', BracketLeft: '[', BracketRight: ']', Semicolon: ';',
    Quote: "'", Minus: '-', Equal: '=', Backquote: '`',
  };
  return map[code] ?? null;
}

export interface SettingsDialogProps {
  onClose: () => void;
}

export function SettingsDialog({ onClose }: SettingsDialogProps) {
  const settings = useSettingsStore((s) => s.settings);
  const save = useSettingsStore((s) => s.save);

  const [hotkey, setHotkey] = useState(settings.hotkey);
  const [recording, setRecording] = useState(false);
  const [conflict, setConflict] = useState<ShortcutCheck | null>(null);

  const [browserMode, setBrowserMode] = useState<BrowserMode>(() => {
    const b = settings.defaultBrowser;
    return (b === 'chrome' || b === 'msedge' || b === 'firefox') ? (b as BrowserMode) : 'system';
  });
  const [customPath, setCustomPath] = useState(
    settings.defaultBrowser === 'chrome' || settings.defaultBrowser === 'msedge' ||
    settings.defaultBrowser === 'firefox' || settings.defaultBrowser === 'system'
      ? '' : settings.defaultBrowser,
  );
  const [autostart, setAutostartLocal] = useState(settings.autostart);
  const [showOnStartup, setShowOnStartup] = useState(settings.showOnStartup);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 快捷键录制：捕获 keydown，组装 'Mod+Key' 并校验。
  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setRecording(false);
        return;
      }
      const token = codeToToken(e.code);
      if (!token) return;
      const mods: string[] = [];
      if (e.altKey) mods.push('Alt');
      if (e.ctrlKey) mods.push('Ctrl');
      if (e.shiftKey) mods.push('Shift');
      if (e.metaKey) mods.push('Super');
      const combo = [...mods, token].join('+');
      setRecording(false);
      setHotkey(combo);
      setConflict(validateShortcut(combo));
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [recording]);

  const resolvedBrowser: string =
    browserMode === 'custom' ? (customPath || 'system') : browserMode;

  const canSave =
    !!hotkey && (conflict === null || conflict.ok) &&
    !(browserMode === 'custom' && !customPath);

  const pickCustom = async () => {
    try {
      const sel = await open({ multiple: false, filters: [{ name: '可执行文件', extensions: ['exe'] }] });
      if (typeof sel === 'string') setCustomPath(sel);
    } catch {
      /* 取消 */
    }
  };

  const exportJson = async () => {
    try {
      const list = await urlsList({ limit: 5000 });
      const { categories } = useUrlStore.getState();
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        categories: categories.map((c) => ({ id: c.id, name: c.name })),
        links: list,
      };
      const content = JSON.stringify(payload, null, 2);
      const filePath = await saveDialog({
        defaultPath: 'links.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!filePath) return;
      await writeTextFile(filePath, content);
    } catch {
      /* 忽略导出失败 */
    }
  };

  const importFromJson = async () => {
    try {
      const sel = await open({ multiple: false, filters: [{ name: 'JSON', extensions: ['json'] }] });
      if (typeof sel !== 'string') return;
      await importJson(sel);
      const store = useUrlStore.getState();
      await store.reload();
      await store.reloadCategories();
    } catch {
      /* 忽略导入失败 */
    }
  };

  const onSave = async () => {
    if (!canSave) return;
    setSaveError(null);
    try {
      const next: Settings = { hotkey, defaultBrowser: resolvedBrowser, autostart, showOnStartup };
      // 自启状态已由 settings_set 在后端统一同步，无需前端再次调用
      await save(next);
      onClose();
    } catch (e) {
      setSaveError(typeof e === 'string' ? e : e instanceof Error ? e.message : '保存失败，请重试');
    }
  };

  const footer = (
    <>
      <button type="button" className="btn btn--secondary" onClick={onClose}>
        取消
      </button>
      <button type="button" className="btn btn--primary" disabled={!canSave} onClick={onSave}>
        <Icon name="check" size={20} />
        <span>保存</span>
      </button>
    </>
  );

  return (
    <Modal title="设置" onClose={onClose} width={440} footer={footer}>
      <div className="settings__section">
        <h3 className="settings__section-title">唤出快捷键</h3>
        <div className="settings__hotkey-row">
          <div
            className={`hotkey-box${conflict && !conflict.ok ? ' hotkey-box--conflict' : ''}`}
          >
            {recording ? '按下组合键…' : hotkey}
          </div>
          <button type="button" className="btn btn--secondary" onClick={() => setRecording((r) => !r)}>
            <Icon name="keyboard" size={20} />
            <span>{recording ? '停止' : '录制'}</span>
          </button>
        </div>
        {conflict && !conflict.ok && (
          <p className="field__error">{conflict.message}</p>
        )}
      </div>

      <div className="settings__section">
        <h3 className="settings__section-title">默认浏览器</h3>
        <div className="select">
          <select
            className="select__el"
            value={browserMode}
            onChange={(e) => setBrowserMode(e.target.value as BrowserMode)}
          >
            <option value="system">系统默认</option>
            <option value="chrome">Chrome</option>
            <option value="msedge">Microsoft Edge</option>
            <option value="firefox">Firefox</option>
            <option value="custom">自定义路径…</option>
          </select>
          <Icon name="chevronDown" size={20} className="select__icon" />
        </div>
        {browserMode === 'custom' && (
          <div className="settings__custom-row">
            <input
              className="input"
              type="text"
              value={customPath}
              placeholder="C:\\Path\\To\\Browser.exe"
              onChange={(e) => setCustomPath(e.target.value)}
            />
            <button type="button" className="btn btn--secondary" onClick={pickCustom}>
              <Icon name="folderOpen" size={20} />
            </button>
          </div>
        )}
      </div>

      <div className="settings__section">
        <h3 className="settings__section-title">开机自动启动</h3>
        <label className="switch-row">
          <span>开机自动启动</span>
          <button
            type="button"
            role="switch"
            aria-checked={autostart}
            className={`switch${autostart ? ' switch--on' : ''}`}
            onClick={() => setAutostartLocal((v) => !v)}
          >
            <span className="switch__thumb" />
          </button>
        </label>
      </div>

      <div className="settings__section">
        <h3 className="settings__section-title">启动行为</h3>
        <label className="switch-row">
          <span>启动时显示窗口</span>
          <button
            type="button"
            role="switch"
            aria-checked={showOnStartup}
            className={`switch${showOnStartup ? ' switch--on' : ''}`}
            onClick={() => setShowOnStartup((v) => !v)}
          >
            <span className="switch__thumb" />
          </button>
        </label>
      </div>

      <div className="settings__section">
        <h3 className="settings__section-title">数据</h3>
        <div className="settings__data-row">
          <button type="button" className="btn btn--secondary" onClick={exportJson}>
            <Icon name="download" size={20} />
            <span>导出 JSON</span>
          </button>
          <button type="button" className="btn btn--secondary" onClick={importFromJson}>
            <Icon name="upload" size={20} />
            <span>导入 JSON</span>
          </button>
        </div>
      </div>
      {saveError && (
        <p className="field__error" role="alert">{saveError}</p>
      )}
    </Modal>
  );
}
