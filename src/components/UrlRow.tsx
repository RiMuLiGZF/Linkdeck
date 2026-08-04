// 单行网址（DESIGN-PAGES §1.4）。favicon 三态：loading(loader 旋转) / ok(img) / error(monogram)。
// 悬浮操作组默认隐藏，hover/focus-within 显现。
import { useState } from 'react';
import { Icon } from './Icon';
import { getFaviconSrc, getInitial } from '../lib/favicon';
import type { Url } from '../types/models';

export interface UrlRowProps {
  item: Url;
  selected: boolean;
  categoryName?: string | null;
  onOpen: () => void;
  onSelect: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
}

type FavState = 'loading' | 'ok' | 'error';

export function UrlRow({
  item,
  selected,
  categoryName,
  onOpen,
  onSelect,
  onEdit,
  onCopy,
  onDelete,
}: UrlRowProps) {
  const [fav, setFav] = useState<FavState>('loading');
  const favSrc = getFaviconSrc(item.url, item.faviconPath);
  const displayTitle = item.title?.trim() || item.url;

  return (
    <div
      className={`url-row${selected ? ' url-row--selected' : ''}`}
      role="option"
      aria-selected={selected}
      onClick={() => {
        onSelect();
        onOpen();
      }}
    >
      <div className="favicon">
        {fav === 'loading' && <Icon name="loader" size={20} spin className="favicon__loader" />}
        {fav === 'error' && (
          <span className="favicon__monogram" aria-hidden="true">
            {getInitial(item.url)}
          </span>
        )}
        {/* 始终渲染 img 以触发加载；通过 CSS 控制显隐 */}
        <img
          className="favicon__img"
          src={favSrc}
          alt=""
          width={20}
          height={20}
          loading="lazy"
          style={{ display: fav === 'ok' ? undefined : 'none' }}
          onLoad={() => setFav('ok')}
          onError={() => setFav('error')}
        />
      </div>

      <div className="url-row__main">
        <span className="url-row__title">{displayTitle}</span>
        <span className="url-row__url">{item.url}</span>
      </div>

      {categoryName && <span className="category-pill">{categoryName}</span>}

      <div className="url-row__actions" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="action-btn"
          aria-label="打开"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          <Icon name="externalLink" size={16} />
        </button>
        <button
          type="button"
          className="action-btn"
          aria-label="编辑"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <Icon name="pencil" size={16} />
        </button>
        <button
          type="button"
          className="action-btn"
          aria-label="复制网址"
          onClick={(e) => {
            e.stopPropagation();
            onCopy();
          }}
        >
          <Icon name="copy" size={16} />
        </button>
        <button
          type="button"
          className="action-btn action-btn--danger"
          aria-label="删除"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Icon name="trash" size={16} />
        </button>
      </div>
    </div>
  );
}
