// 链接相关命令封装（spec 第 5 节）。
import { invoke } from './tauri';
import type {
  Url,
  UrlCreateArgs,
  UrlUpdateArgs,
  UrlsListArgs,
} from '../types/models';

export const urlsList = (args: UrlsListArgs): Promise<Url[]> =>
  invoke<Url[]>('urls_list', args);

export const urlCreate = (args: UrlCreateArgs): Promise<Url> =>
  invoke<Url>('url_create', args);

export const urlUpdate = (args: UrlUpdateArgs): Promise<Url> =>
  invoke<Url>('url_update', args);

export const urlDelete = (id: string): Promise<void> =>
  invoke<void>('url_delete', { id });

export const urlRefreshMeta = (id: string): Promise<Url> =>
  invoke<Url>('url_refresh_meta', { id });
