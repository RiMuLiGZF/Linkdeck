// 单行网址（DESIGN-PAGES §1.4）。favicon 三态：loading(loader 旋转) / ok(img) / error(monogram)。
// 悬浮操作组默认隐藏，hover/focus-within 显现。
// 当项目有 startDate 时，额外显示比赛日期范围与状态标签。
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import { getFaviconFallbacks, getInitial } from '../lib/favicon';
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

/** 根据 startDate/endDate 计算比赛状态 */
function getCompetitionStatus(startDate: string | null, endDate: string | null): { label: string; className: string } | null {
  if (!startDate) return null;
  const now = Date.now();
  const start = new Date(startDate).getTime();
  if (endDate) {
    const end = new Date(endDate).getTime();
    if (now < start) return { label: '未开始', className: 'status-tag--upcoming' };
    if (now > end) return { label: '已结束', className: 'status-tag--ended' };
    return { label: '进行中', className: 'status-tag--ongoing' };
  }
  // 仅有开始时间
  if (now < start) return { label: '未开始', className: 'status-tag--upcoming' };
  return { label: '进行中', className: 'status-tag--ongoing' };
}

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
  const fallbacks = useMemo(() => getFaviconFallbacks(item.url, item.faviconPath), [item.url, item.faviconPath]);
  const fallbackIdx = useRef(0);
  const [favSrc, setFavSrc] = useState(fallbacks[0]);
  const displayTitle = item.title?.trim() || item.url;

  const competitionStatus = getCompetitionStatus(item.startDate, item.endDate);

  // faviconPath 由后台抓取异步回填：备选源变化时重置加载状态，重新走本地图标
  useEffect(() => {
    setFav('loading');
    fallbackIdx.current = 0;
    setFavSrc(fallbacks[0]);
  }, [fallbacks]);

  // 防呆：当前源长时间无响应（既未加载也未报错）时切到下一个备选源，避免 loader 永转
  useEffect(() => {
    if (fav !== 'loading') return;
    const timer = setTimeout(() => {
      if (fallbackIdx.current < fallbacks.length - 1) {
        fallbackIdx.current += 1;
        setFavSrc(fallbacks[fallbackIdx.current]);
      } else {
        setFav('error');
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [fav, favSrc, fallbacks]);

  const handleError = () => {
    if (fallbackIdx.current < fallbacks.length - 1) {
      // 尝试下一个备选源
      fallbackIdx.current += 1;
      setFavSrc(fallbacks[fallbackIdx.current]);
    } else {
      // 所有源都失败，显示 monogram
      setFav('error');
    }
  };

  /** 格式化日期显示 */
  const formatDate = (d: string) => {
    try {
      const date = new Date(d);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    } catch {
      return d;
    }
  };

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
          style={{ display: fav === 'ok' ? undefined : 'none' }}
          onLoad={() => setFav('ok')}
          onError={handleError}
        />
      </div>

      <div className="url-row__main">
        <span className="url-row__title">{displayTitle}</span>
        <span className="url-row__url">{item.url}</span>
        {competitionStatus && (
          <span className="url-row__dates">
            <Icon name="calendar" size={16} className="url-row__date-icon" />
            {formatDate(item.startDate!)}
            {item.endDate && <> ~ {formatDate(item.endDate)}</>}
            <span className={`status-tag ${competitionStatus.className}`}>{competitionStatus.label}</span>
          </span>
        )}
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