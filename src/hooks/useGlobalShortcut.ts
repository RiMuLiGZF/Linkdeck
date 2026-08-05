// 全局快捷键同步（spec F1 + §11 IME 坑）。
// Rust 端始终负责全局快捷键注册/注销（含设置变更后热更新），并通过
// `panel:toggle` 事件通知前端。前端仅监听该事件以同步 visible 状态，
// 避免双重注册/双重切换。
import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';

/**
 * 监听 Rust 端 panel:toggle 事件，同步面板可见性。
 * Rust 是全局快捷键的唯一注册者；前端只消费事件。
 */
export function useGlobalShortcut(_hotkey: string, onToggle: (visible: boolean) => void): void {
  useEffect(() => {
    // 监听 Rust 端托盘/快捷键触发的面板切换事件
    const unlistenPromise = listen<boolean>('panel:toggle', (event) => {
      // Rust 端切换面板时触发，前端同步 visible 状态
      onToggle(event.payload);
    });

    return () => {
      unlistenPromise.then((fn) => fn()).catch(() => {});
    };
  }, [onToggle]);
}
