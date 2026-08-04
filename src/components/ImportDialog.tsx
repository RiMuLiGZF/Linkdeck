// 导入书签（DESIGN-PAGES §3）。选 .html 文件 → 调 bookmarks_import → 显示结果。
// 大文件导入期间显示 indeterminate 进度条，不卡 UI。
import { useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { Modal } from './Modal';
import { Icon } from './Icon';
import { useUrlStore } from '../stores/useUrlStore';

type Status = 'idle' | 'importing' | 'done' | 'error';

export interface ImportDialogProps {
  onClose: () => void;
}

export function ImportDialog({ onClose }: ImportDialogProps) {
  const pendingImportPath = useUrlStore((s) => s.pendingImportPath);
  const importBookmarks = useUrlStore((s) => s.importBookmarks);
  const closeModal = useUrlStore((s) => s.closeModal);

  const [filePath, setFilePath] = useState<string>('');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  useEffect(() => {
    if (pendingImportPath) setFilePath(pendingImportPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: '书签文件', extensions: ['html', 'htm'] }],
      });
      if (typeof selected === 'string') setFilePath(selected);
    } catch {
      /* 取消或失败 */
    }
  };

  const startImport = async () => {
    if (!filePath || status === 'importing') return;
    setStatus('importing');
    setResult(null);
    try {
      const r = await importBookmarks(filePath);
      setResult(r);
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  const footer = (
    <>
      <button type="button" className="btn btn--secondary" onClick={onClose}>
        取消
      </button>
      {status === 'done' ? (
        <button type="button" className="btn btn--primary" onClick={closeModal}>
          完成
        </button>
      ) : (
        <button
          type="button"
          className="btn btn--primary"
          disabled={!filePath || status === 'importing'}
          onClick={startImport}
        >
          <Icon name="upload" size={20} />
          <span>开始导入</span>
        </button>
      )}
    </>
  );

  return (
    <Modal title="导入书签" onClose={onClose} width={400} footer={footer}>
      <div className="field">
        <button type="button" className="btn btn--secondary" onClick={pickFile}>
          <Icon name="folderOpen" size={20} />
          <span>选择文件</span>
        </button>
        {filePath && <p className="import__file">{filePath}</p>}
      </div>

      {status === 'importing' && (
        <div className="progress" aria-label="导入中">
          <div className="progress__bar progress__bar--indeterminate" />
        </div>
      )}

      {status === 'done' && result && (
        <p className="import__result">
          <Icon name="check" size={16} className="import__result-icon" />
          已导入 {result.imported} 条，跳过 {result.skipped} 条重复
        </p>
      )}

      {status === 'error' && (
        <p className="import__error">
          <Icon name="alertTriangle" size={16} className="import__error-icon" />
          文件已损坏或不是有效的 Netscape 书签文件
        </p>
      )}
    </Modal>
  );
}
