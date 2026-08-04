// 窗口级拖拽双通道（spec §11 坑：WebView2 链接拖拽 MIME 歧义）。
// 通道 A（Rust）：getCurrentWindow().onDragDropEvent 拿到文件路径 / uris。
//   - .html / .htm 文件 → 触发书签导入
//   - 包含 http(s) 的 paths / uris → 逐个快速添加
// 通道 B（前端兜底）：window 'drop' 取 dataTransfer.getData('text/uri-list')，
//   交给 invoke('drag_resolve') 解析（与通道 A 汇聚同一 resolve 逻辑）。
import { useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { dragResolve } from '../services/bookmarks';

interface DragHandlers {
  onHtmlPath: (path: string) => void;
  onUrls: (urls: string[]) => void;
}

function pickHtml(paths: string[]): string | undefined {
  return paths.find((p) => /\.html?$/i.test(p));
}

function extractUrls(paths: string[], uris: string[]): string[] {
  const all = [...paths, ...uris];
  return all.filter((s) => /^https?:\/\//i.test(s.trim())).map((s) => s.trim());
}

/** 返回 isDragging 供遮罩层使用。 */
export function useDragDrop(handlers: DragHandlers): boolean {
  const [isDragging, setIsDragging] = useState(false);
  // 用 ref 持有最新 handlers，避免每次渲染都重新订阅窗口事件。
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    // 通道 A：Rust 窗口拖拽事件
    const win = getCurrentWindow();
    win
      .onDragDropEvent((event) => {
        const payload = event.payload as {
          type: 'enter' | 'over' | 'drop' | 'leave';
          paths: string[];
          uris: string[];
        };
        if (payload.type === 'over' || payload.type === 'enter') {
          setIsDragging(true);
          return;
        }
        if (payload.type === 'leave') {
          setIsDragging(false);
          return;
        }
        if (payload.type === 'drop') {
          setIsDragging(false);
          const html = pickHtml(payload.paths);
          if (html) {
            ref.current.onHtmlPath(html);
            return;
          }
          const urls = extractUrls(payload.paths, payload.uris);
          if (urls.length) ref.current.onUrls(urls);
        }
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {
        /* 窗口事件不可用（非 Tauri 环境）时忽略 */
      });

    // 通道 B：HTML5 drop 兜底（text/uri-list）
    const onOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('text/uri-list')) {
        e.preventDefault();
        setIsDragging(true);
      }
    };
    const onLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) setIsDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      const uriList = e.dataTransfer?.getData('text/uri-list');
      setIsDragging(false);
      if (!uriList) return;
      e.preventDefault();
      const lines = uriList
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => /^https?:\/\//i.test(s));
      if (lines.length) {
        dragResolve(lines)
          .then((drafts) => {
            const urls = drafts.map((d) => d.url).filter((u) => /^https?:\/\//i.test(u));
            if (urls.length) ref.current.onUrls(urls);
          })
          .catch(() => {
            /* 解析失败时静默降级 */
          });
      }
    };

    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);

    return () => {
      unlisten?.();
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  return isDragging;
}
