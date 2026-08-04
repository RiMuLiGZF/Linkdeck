// 分类 CRUD 命令封装。
import { invoke } from './tauri';
import type { Category, CategoryCreateArgs, CategoryUpdateArgs } from '../types/models';

export const categoriesList = (): Promise<Category[]> =>
  invoke<Category[]>('categories_list', {});

export const categoryCreate = (args: CategoryCreateArgs): Promise<Category> =>
  invoke<Category>('category_create', args);

export const categoryUpdate = (args: CategoryUpdateArgs): Promise<Category> =>
  invoke<Category>('category_update', args);

export const categoryDelete = (id: string): Promise<void> =>
  invoke<void>('category_delete', { id });

export const categoryReorder = (orderedIds: string[]): Promise<void> =>
  invoke<void>('category_reorder', { orderedIds: orderedIds });
