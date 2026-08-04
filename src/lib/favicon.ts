// favicon 路径解析与离线降级 monogram 逻辑（DESIGN-PAGES §1.4）。
import { toAssetUrl } from '../services/tauri';

/** 从 url 提取主机名（去协议、去端口）。非法返回原串。 */
export function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** 取域名首字母（大写），用于 monogram 降级。剥离前导 www.。 */
export function getInitial(url: string): string {
  const host = getDomain(url).replace(/^www\./i, '');
  const ch = host.charAt(0);
  return ch ? ch.toUpperCase() : '?';
}

/**
 * 取 favicon 图片源：
 * - 有本地缓存（faviconPath）→ 走 asset:// 协议（需 capabilities 授予 asset:default）
 * - 否则返回在线源列表（Google → DuckDuckGo），离线/失败由 <img> onError 降级 monogram
 */
export function getFaviconSrc(url: string, faviconPath?: string | null): string {
  if (faviconPath) return toAssetUrl(faviconPath);
  const host = getDomain(url);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`;
}

/**
 * 获取 favicon 备选源列表（用于降级链）。
 * 顺序：Google → DuckDuckGo
 */
export function getFaviconFallbacks(url: string, faviconPath?: string | null): string[] {
  if (faviconPath) return [toAssetUrl(faviconPath)];
  const host = getDomain(url);
  return [
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`,
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`,
  ];
}
