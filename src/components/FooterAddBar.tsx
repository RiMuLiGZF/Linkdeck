// 底部添加条（DESIGN-PAGES §1.5）。主操作「添加网址」+ 次操作「导入」+ 拖拽提示。
import { Icon } from './Icon';

export interface FooterAddBarProps {
  onAdd: () => void;
  onImport: () => void;
}

export function FooterAddBar({ onAdd, onImport }: FooterAddBarProps) {
  return (
    <div className="footer">
      <button type="button" className="btn btn--primary" onClick={onAdd}>
        <Icon name="plus" size={20} />
        <span>添加网址</span>
      </button>
      <button type="button" className="btn btn--secondary" onClick={onImport}>
        <Icon name="upload" size={20} />
        <span>导入</span>
      </button>
      <span className="footer__hint">将链接拖入此处</span>
    </div>
  );
}
