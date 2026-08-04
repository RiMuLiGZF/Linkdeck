# 网址板 — 本地构建指南

> 最后更新：2026-08-03
> 项目：Windows 桌面网址启动器（Tauri 2 + React 18 + SQLite）

---

## 一、前置条件

| 工具 | 版本要求 | 验证命令 |
|------|----------|----------|
| **Rust (rustup)** | stable, ≥1.78 | `rustc --version` |
| **MSVC Build Tools** | Visual Studio Build Tools 2022 + "C++ 开发"工作负载 | `where link.exe` 应输出 VS 路径 |
| **Node.js** | ≥18 LTS | `node -v` |
| **WebView2 Runtime** | ≥150.0（Win10/11 通常已预装） | 检查 `C:\Program Files (x86)\Microsoft\EdgeWebView\Application` |

### 安装 Rust（如未安装）

```powershell
# PowerShell（管理员）
winget install Rustlang.Rustup
# 或从 https://rustup.rs 下载 rustup-init.exe
```

安装完成后重启终端，确认：

```powershell
rustc --version    # rustc 1.8x.x (xxxx-xx-xx)
cargo --version    # cargo 1.8x.x (xxxx-xx-xx)
```

### 安装 MSVC Build Tools（关键——Windows 上 Rust 编译的硬前提）

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --quiet"
```

> **注意**：安装后需重启终端，`link.exe` 才会出现在 PATH 中。

---

## 二、构建步骤

### 2.1 前端依赖（一次性）

```bash
cd C:\项目\网址板
npm install
```

> 已有 `node_modules/` 且 `package-lock.json` 一致时可跳过。

### 2.2 类型检查（可选，验证前端）

```bash
npm run typecheck
# 预期：零错误（tsc --noEmit 通过）
```

### 2.3 开发模式（热重载，调试用）

```bash
npm run tauri dev
```

预期行为：
1. 自动启动 Vite dev server（`http://localhost:1420`）
2. 编译 Rust 后端并启动 WebView2 窗口
3. 右上角出现无边框浮窗「网址板」
4. 系统托盘出现墨蓝圆角书签图标
5. 按 **Alt+Space** 可切换面板显隐

### 2.4 生产构建（产出 .exe 安装包）

```bash
npm run tauri build
```

成功后安装包位于：

```
src-tauri/target/release/bundle/nsis/网址板_0.1.0_x64-setup.exe   # NSIS 安装包
src-tauri/target/release/bundle/msi/网址板_0.1.0_x64_en-US.msi     # MSI 安装包
src-tauri/target/release/url-launcher.exe                           # 单文件可执行程序
```

---

## 三、首次运行后的操作

1. **添加网址**：点击底部「添加网址」或拖入浏览器链接
2. **导入书签**：设置 → 导入 → 选浏览器导出的 `.html` 书签文件
3. **指定浏览器**：设置 → 默认浏览器（system / Chrome / Edge / Firefox / 自定义路径）
4. **修改快捷键**：设置 → 全局快捷键（默认 Alt+Space；避免 Ctrl+Space，会被 Windows IME 抢占）
5. **开机自启**：设置 → 开机自动启动

---

## 四、常见问题排查

### Q1: `cargo tauri build` 报 "link.exe not found"

**原因**：未安装 MSVC Build Tools，或安装后未重启终端。

**解决**：执行上方"安装 MSVC Build Tools"，然后**完全关闭并重新打开终端**。

### Q2: `npm run tauri dev` 白屏 / 无法加载页面

**原因**：Vite 端口与 `tauri.conf.json` 的 `devUrl` 不匹配。

**解决**：本项目已对齐为 `1420`。若仍白屏：

```bash
# 确认 Vite 实际监听端口
npm run dev
# 终端应显示 Local: http://localhost:1420/
# 若不是 1420，修改 src-tauri/tauri.conf.json 的 devUrl 为实际端口
```

### Q3: 托盘图标不显示 / 启动报错 "未找到窗口图标"

**原因**：`src-tauri/icons/` 缺失。

**解决**：重新生成图标：

```bash
node scripts/gen-icons.mjs
```

### Q4: Alt+Space 快捷键无反应

**可能原因**：
- Windows IME 占用了 Ctrl+Space（本项目默认用 Alt+Space，不受影响）
- 某些远程桌面软件抢占全局快捷键
- 快捷键格式不合法

**排查**：在设置中更换快捷键（如 `Alt+Q`），保存后立即生效。

### Q5: 高分屏（125%/150%/200% DPI）面板位置偏移

**已知问题**：DPI 缩放可能导致右上角锚定偏差。

**临时解决**：在设置中切换一次快捷键或重启应用（会重新计算 scale_factor）。
**根因位置**：`src-tauri/src/lib.rs` 的 `anchor_top_right()` 函数。

### Q6: 导入书签后中文乱码

**原因**：浏览器导出编码非 UTF-8（Chrome/Edge 通常为 UTF-8，Firefox 可能是 GBK）。

**解决**：用文本编辑器将 `.html` 文件另存为 UTF-8 编码后再导入。

---

## 五、项目结构速查

```
C:\项目\网址板\
├── src-tauri/              # Rust/Tauri 后端
│   ├── Cargo.toml          # Rust 依赖（版本冻结）
│   ├── tauri.conf.json     # Tauri 配置（窗口/打包/插件）
│   ├── icons/              # 应用图标（gen-icons.mjs 生成）
│   └── src/
│       ├── main.rs         # 入口
│       ├── lib.rs          # 核心装配（托盘/快捷键/锚定/DragDrop）
│       ├── state.rs        # AppState（DB + HTTP client + favicon 信号量）
│       ├── tray.rs         # 系统托盘
│       ├── error.rs        # AppError 枚举
│       ├── models.rs       # 领域结构体（serde camelCase）
│       ├── shortcut.rs     # 快捷键校验
│       ├── dragdrop.rs     # 拖拽解析（双通道）
│       ├── commands/       # IPC 命令（20 个 #[tauri::command]）
│       ├── db/             # SQLite 连接 + 迁移 + Repository
│       └── bookmarks/      # Netscape 书签解析
├── src/                    # React/TS 前端
│   ├── components/         # UI 组件（LauncherPanel + 对话框）
│   ├── services/           # Tauri invoke 封装 + opener 浏览器打开
│   ├── stores/             # Zustand 状态管理
│   ├── hooks/              # 自定义 Hook（搜索防抖/拖拽/快捷键）
│   ├── types/              # TypeScript 接口定义
│   ├── lib/                # favicon 回退逻辑 + design-tokens.css
│   ├── App.tsx             # 顶层组件（事件监听 + 面板切换）
│   └── main.tsx            # 入口挂载
├── scripts/gen-icons.mjs   # 图标生成脚本（纯 Node，无依赖）
├── tokens.css              # 设计 Token（CSS 变量）
├── design-tokens.json      # Token JSON 定义
├── spec.md                 # 规格契约（13 章，锁定范围/API/Token/验收标准）
├── PRD.md                  # 产品需求文档
├── DESIGN.md               # UI/UX 设计规约
├── DESIGN-PAGES.md         # 组件级实现规约
├── openapi.yaml            # OpenAPI 3.0 IPC 契约
└── docs/                   # 架构文档 / ADR / QA 报告
```

---

## 六、技术栈版本锁定

| 层 | 技术 | 版本 | 用途 |
|----|------|------|------|
| 桌面框架 | Tauri | 2.11.5 | 窗口/托盘/IPC/打包 |
| 后端语言 | Rust | stable ≥1.78 | 系统级能力 |
| 数据库 | rusqlite (bundled) | 0.32.1 | SQLite 3.46 内嵌 |
| 前端框架 | React | 18.3.1 | UI 渲染 |
| 构建工具 | Vite | 5.4.x | 前端打包 |
| 语言 | TypeScript | 5.6.x | 类型安全 |
| 图标库 | lucide-react | 1.24.0 | SVG 功能图标（唯一） |
| 状态管理 | zustand | 4.5.x | 轻量状态 |
| 虚拟滚动 | @tanstack/react-virtual | 3.x | 大列表性能 |

---

## 七、安全说明

- **URL 安全**：仅允许 `http://https` 协议（`ensure_safe_url` 强校验，AC-15）
- **数据存储**：SQLite WAL 模式，数据目录 `%APPDATA%/dev.url-launcher/`
- **网络请求**：favicon/title 抓取限 5s 超时、≤2MB、4 并发信号量
- **无遥测**：无第三方分析/追踪代码
