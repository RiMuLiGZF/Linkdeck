// 分类管理对话框：新增 / 重命名 / 删除分类。
import { useState } from 'react';
import { Modal } from './Modal';
import { Icon } from './Icon';
import { useUrlStore } from '../stores/useUrlStore';
import type { Category } from '../types/models';

export interface CategoryManageDialogProps {
  onClose: () => void;
}

export function CategoryManageDialog({ onClose }: CategoryManageDialogProps) {
  const categories = useUrlStore((s) => s.categories);
  const reloadCategories = useUrlStore((s) => s.reloadCategories);
  const reload = useUrlStore((s) => s.reload);

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    try {
      const { categoryCreate } = await import('../services/categories');
      await categoryCreate({ name });
      setNewName('');
      await reloadCategories();
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败');
    }
  };

  const handleRename = async (cat: Category) => {
    const name = editName.trim();
    if (!name || name === cat.name) {
      setEditingId(null);
      return;
    }
    setError(null);
    try {
      const { categoryUpdate } = await import('../services/categories');
      await categoryUpdate({ id: cat.id, name });
      setEditingId(null);
      await reloadCategories();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : '重命名失败');
    }
  };

  const handleDelete = async (cat: Category) => {
    if (!window.confirm(`确定要删除分类「${cat.name}」吗？其下的书签将被移入「未分类」。`)) {
      return;
    }
    setError(null);
    try {
      const { categoryDelete } = await import('../services/categories');
      await categoryDelete(cat.id);
      await reloadCategories();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
  };

  return (
    <Modal title="管理分类" onClose={onClose} width={380}>
      {/* 新增 */}
      <div className="field">
        <label className="field__label">新建分类</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            className="input"
            type="text"
            value={newName}
            placeholder="输入分类名称"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleAdd(); } }}
          />
          <button
            type="button"
            className="btn btn--primary"
            disabled={!newName.trim()}
            onClick={() => void handleAdd()}
          >
            <Icon name="plus" size={20} />
          </button>
        </div>
      </div>

      {error && <p className="field__error">{error}</p>}

      {/* 分类列表 */}
      <div className="field">
        <label className="field__label">已有分类（{categories.length}）</label>
        <div className="category-manage__list">
          {categories.length === 0 && (
            <p className="category-manage__empty">暂无分类</p>
          )}
          {categories.map((cat) => (
            <div key={cat.id} className="category-manage__item">
              {editingId === cat.id ? (
                <>
                  <input
                    className="input"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); void handleRename(cat); }
                      if (e.key === 'Escape') { setEditingId(null); }
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="action-btn"
                    aria-label="确认重命名"
                    onClick={() => void handleRename(cat)}
                  >
                    <Icon name="check" size={16} />
                  </button>
                  <button
                    type="button"
                    className="action-btn"
                    aria-label="取消"
                    onClick={() => setEditingId(null)}
                  >
                    <Icon name="x" size={16} />
                  </button>
                </>
              ) : (
                <>
                  <Icon name="folder" size={16} className="category-manage__item-icon" />
                  <span className="category-manage__item-name">{cat.name}</span>
                  <span className="category-manage__item-count">{cat.count}</span>
                  <button
                    type="button"
                    className="action-btn"
                    aria-label="重命名"
                    onClick={() => startEdit(cat)}
                  >
                    <Icon name="pencil" size={16} />
                  </button>
                  <button
                    type="button"
                    className="action-btn action-btn--danger"
                    aria-label="删除分类"
                    onClick={() => void handleDelete(cat)}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
