import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Tauri 偏好固定的 dev 端口，并用 TAURI_ 前缀透传环境变量给 Rust 侧读取。
export default defineConfig({
  plugins: [react()],
  // Tauri 接管控制台，关闭 Vite 清屏以免吞掉 Rust 日志。
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: 'localhost',
  },
  build: {
    // Tauri 默认 frontendDist 为 ../dist
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2021',
  },
  envPrefix: ['VITE_', 'TAURI_'],
});
