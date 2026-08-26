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
 * 取 favicon 备选源列表（用于降级链）。
 * 顺序：本地缓存（asset://）→ 站点自身 /favicon.ico → Google → DuckDuckGo → monogram。
 * 站点自身 favicon 放在在线源首位：Google/DuckDuckGo 在国内网络常不可达，本地抓取失败时优先直连站点。
 */
export function getFaviconFallbacks(url: string, faviconPath?: string | null): string[] {
  const host = getDomain(url);
  const online = [
    `https://${host}/favicon.ico`,
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`,
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`,
  ];
  return faviconPath ? [toAssetUrl(faviconPath), ...online] : online;
}
