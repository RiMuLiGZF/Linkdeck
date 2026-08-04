import { createRoot } from 'react-dom/client';
import App from './App';
import './lib/design-tokens.css';

// 注意：刻意不使用 React.StrictMode。
// Tauri 全局快捷键 / 窗口事件在 StrictMode 的开发期双调用下会重复注册，
// 导致 "shortcut already registered" 等副作用。生产构建无影响，这里统一规避。
const container = document.getElementById('root');
if (!container) throw new Error('root container missing');

createRoot(container).render(<App />);
