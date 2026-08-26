// 添加 / 编辑网址（DESIGN-PAGES §2）。URL 必填且须 ^https?:// 开头；Enter 提交；Esc 关闭。
import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Icon } from './Icon';
import { useUrlStore } from '../stores/useUrlStore';
import type { Category } from '../types/models';

const URL_RE = /^https?:\/\/.+/i;

export interface AddUrlDialogProps {
  onClose: () => void;
}

export function AddUrlDialog({ onClose }: AddUrlDialogProps) {
  const editItem = useUrlStore((s) => s.editItem);
  const prefill = useUrlStore((s) => s.prefill);
  const categories = useUrlStore((s) => s.categories);
  const addUrl = useUrlStore((s) => s.addUrl);
  const updateUrl = useUrlStore((s) => s.updateUrl);
  const closeModal = useUrlStore((s) => s.closeModal);

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [categoryId, setCategoryId] = useState<string>(''); // '' = 未分类
  const [touched, setTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (editItem) {
      setName(editItem.title ?? '');
      setUrl(editItem.url);
      setCategoryId(editItem.categoryId ?? '');
    } else if (prefill) {
      setUrl(prefill.url);
      setName(prefill.title ?? '');
      setCategoryId('');
    }
    // 仅在打开时初始化一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const urlValid = URL_RE.test(url.trim());
  const showError = touched && !urlValid;

  const submit = async () => {
    if (!urlValid) {
      setTouched(true);
      return;
    }
    setSubmitError(null);
    try {
      const cat = categoryId === '' ? null : categoryId;
      if (editItem) {
        await updateUrl({ id: editItem.id, title: name.trim() || null, categoryId: cat });
      } else {
        await addUrl({ url: url.trim(), title: name.trim() || null, categoryId: cat });
      }
      closeModal();
    } catch (e) {
      setSubmitError(typeof e === 'string' ? e : e instanceof Error ? e.message : '保存失败，请重试');
    }
  };

  const footer = (
    <>
      <button type="button" className="btn btn--secondary" onClick={onClose}>
        取消
      </button>
      <button
        type="submit"
        form="add-url-form"
        className="btn btn--primary"
        disabled={!urlValid}
      >
        <Icon name="check" size={20} />
        <span>确认</span>
      </button>
    </>
  );

  return (
    <Modal title={editItem ? '编辑网址' : '添加网址'} onClose={onClose} width={360} footer={footer}>
      <form id="add-url-form" className="form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="field">
          <label className="field__label" htmlFor="add-name">
            名称（选填）
          </label>
          <input
            id="add-name"
            className="input"
            type="text"
            value={name}
            placeholder="留空则自动抓取网页标题"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="add-url">
            URL
          </label>
          <input
            id="add-url"
            className={`input${showError ? ' input--error' : ''}`}
            type="text"
            value={url}
            placeholder="https://example.com"
            aria-invalid={showError}
            aria-describedby={showError ? 'add-url-error' : undefined}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => setTouched(true)}
          />
          {showError && (
            <p id="add-url-error" className="field__error">
              请输入以 http:// 或 https:// 开头的网址
            </p>
          )}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="add-category">
            分类
          </label>
          <div className="select">
            <select
              id="add-category"
              className="select__el"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">未分类</option>
              {categories
                .filter((c: Category) => c.id !== '__uncategorized__')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            <Icon name="chevronDown" size={20} className="select__icon" />
          </div>
        </div>
        {submitError && (
          <p className="field__error" role="alert">{submitError}</p>
        )}
      </form>
    </Modal>
  );
}
