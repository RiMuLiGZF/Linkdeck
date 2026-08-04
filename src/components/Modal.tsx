// 模态外壳：覆盖层 + 标题栏（含关闭按钮）+ 内容 + 底部操作区。
// 统一处理 Esc 关闭、初始聚焦与基础焦点陷阱（Tab 循环），并尊重 reduced-motion。
import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

export interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  closeLabel?: string;
}

export function Modal({ title, onClose, children, footer, width = 360, closeLabel = '关闭' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 初始聚焦容器（便于后续 Tab 陷阱），并绑定 Esc。
  useEffect(() => {
    const node = containerRef.current;
    node?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        // 基础焦点陷阱：在可聚焦元素间循环。
        const focusables = node?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    node?.addEventListener('keydown', onKey);
    return () => node?.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        ref={containerRef}
        className="modal"
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="modal__header">
          <h2 className="modal__title">{title}</h2>
          <button
            type="button"
            className="icon-btn"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <Icon name="x" size={20} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__actions">{footer}</div>}
      </div>
    </div>
  );
}
