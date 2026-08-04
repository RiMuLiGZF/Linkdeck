# url-launcher 架构方案（Windows 桌面端网址启动器）

- **代号**：url-launcher
- **形态**：系统托盘常驻 + 全局快捷键唤出 + 右上角面板
- **平台**：仅 Windows（10/11），零后端、本地优先
- **架构师**：高见远（MVP 开发专家团 · 首席架构师）
- **日期**：2026-08-02
- **状态**：草案（待 team-lead / PM 评审）
- **规范依据**：spec-as-contract、context-engineering、generated-code-failure-modes、mvp-stack、development-costs、code-organization

---

## 0. 结论速览（Tauri 2 on Windows 能力可行性）

| 能力 | 结论 | 关键依据 / 坑 |
|------|------|----------------|
| 系统托盘图标与菜单 | **可行** | Tauri 2 用 `tauri::tray::TrayIconBuilder`（v2 API，非 v1 的 `SystemTray`），Windows 一等支持；左/右键、菜单事件齐全 |
| 全局快捷键（可录制自定义） | **可行，但有坑** | `tauri-plugin-global-shortcut` 支持 Windows；JS 端 `register('CommandOrControl+Space', fn)` 字符串化，便于录制。**坑：Windows 上 `Ctrl+Space` 是输入法切换键（IME），会与系统冲突**，需检测并提示用户改键 |
| 指定浏览器启动（exe + URL，非仅系统默认） | **可行** | `tauri-plugin-opener` 的 `open_url(url, Some("chrome"|"msedge"|"firefox"|exe路径))`；需在 capability 中按 `app` 作用域白名单 |
| 窗口拖拽接收链接（文件/文本） | **可行，但有坑** | `dragDropEnabled:true`（默认）拦截为 `tauri://drag-drop`，payload 给 `paths`（文件路径）。**坑：从浏览器拖"链接"时 WebView2 常把 URL 作为文件/文本传入，需同时处理 `paths` 与 HTML5 `dataTransfer.getData('text/uri-list')` 两条路径** |
| 书签 HTML 解析 | **可行** | 纯 Rust 字符串/HTML 解析；浏览器书签为 Netscape 标准格式（`<DT><A HREF=...>`），用 `scraper` 或状态机解析，无 Tauri 特殊依赖 |
| favicon/title 在线抓取 + 离线降级 | **可行** | Rust `reqwest`(async) + `scraper` 解析 `<title>`/`<link rel=icon>`；超时(5s)+失败→前端用 Lucide 默认图标。**坑：SPA 站点 `<title>` 可能是占位；部分站点按 UA 拦截** |
| 开机自启 | **可行** | `tauri-plugin-autostart`，Windows 写 `HKCU\...\Run`，无需管理员权限 |
| 窗口贴右上角 | **可行** | 窗口配置 `decorations:false` + `alwaysOnTop:true` + 手动定位（用 `current_monitor()`+`scale_factor` 算主屏右上角，避免引入额外 positioner 插件） |

**总体结论**：Tauri 2 完全覆盖本项目全部能力，唯一两个"有坑"点（全局快捷键 IME 冲突、链接拖拽的 MIME 歧义）均有明确缓解方案，不影响 MVP 可行性。推荐采用 Tauri 2。

---

## 1. 技术选型对比矩阵（3 方案）

评分 1–5，越高越好。本团队为 Web 技术栈（前端 React + 设计/产品），评估含"本团队适配度"。

| 维度 | Tauri 2 | Electron | .NET WinForms + WebView2 |
|------|:------:|:------:|:------:|
| 安装体积 | **5**（≈8–15 MB，复用系统 WebView2） | 1（≈120 MB，内嵌 Chromium） | 3（≈20–40 MB，WebView2 共享） |
| 启动速度 | **5**（冷启 <1s，Rust 核心） | 2（Chromium 1–3s+） | 4（原生 .NET，<1s） |
| 开发成本（本团队 Web 栈） | 4（少量 Rust，前端全 React） | **5**（纯 JS/TS，零 Rust） | 2（C#+web 割裂，团队需转 C#） |
| 能力覆盖 | **5**（tray/shortcut/opener/autostart/dnd/fs 全为官方插件） | 5（Node 直接 spawn、API 齐备） | 5（NotifyIcon/RegisterHotKey/Process.Start/WebView2 DnD 全原生） |
| 维护风险 | 4（生态活跃、迭代快、插件需对齐版本） | 4（成熟但体积/安全更新负担大） | 3（WinForms 老旧，长期维护观感差） |
| **合计** | **23** | **17** | **17** |

**推荐：Tauri 2。** 理由：
1. 体积/启动速度对"常驻托盘的小工具"是决定体验的指标，Tauri 碾压 Electron；
2. 前端沿用 React，团队无需切换语言；Rust 仅承担"薄系统层"（tray/shortcut/opener/fetch），学习成本可控；
3. 零后端、本地优先与 Tauri 的"无服务端、纯本地二进制"哲学天然契合；
4. 官方插件生态已覆盖本项目 100% 能力，无需自造轮子。

Electron 备选仅在"团队完全不会 Rust、且体积不敏感"时成立；.NET 方案在团队为 Web 栈时开发成本反而最高，不推荐。

---

## 2. 核心功能技术可行性验证（逐条）

> 所有代码片段基于锁定版本（见 §3）的 API 撰写；实现前须以 `cargo add` / `npm install` 解析出的真实版本核对签名（遵循 generated-code-failure-modes「版本锚定」纪律）。

### 2.1 系统托盘图标与菜单

**方案**：Tauri 2 使用 `tauri::tray::TrayIconBuilder`（v2 新 API；v1 的 `SystemTray` 已废弃）。

```rust
// src-tauri/src/tray.rs（示意，须按 tauri 2.11.x API 核对）
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::Manager;

pub fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    let menu = Menu::with_items(app, &[
        &MenuItem::with_id(app, "toggle", "显示/隐藏面板", true, None)?,
        &PredefinedMenuItem::separator(app)?,
        &MenuItem::with_id(app, "settings", "设置", true, None)?,
        &PredefinedMenuItem::separator(app)?,
        &MenuItem::with_id(app, "quit", "退出", true, None)?,
    ])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false) // 左键只触发点击，右键出菜单
        .on_menu_event(|app, event| match event.id().as_ref() {
            "toggle" => toggle_main_window(app),
            "settings" => emit_to_frontend(app, "open-settings"),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|_tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                // 左键点击 → 切换面板显隐
            }
        })
        .build(app)?;
    Ok(())
}
```

**可行性**：Windows 一等支持，证据充分。**坑**：托盘图标必须是 `.ico`/PNG，且 Windows 任务栏托盘区尺寸小，图标需 16/32px 两档；CI 构建需在 `tauri.conf.json` 配置 `icon`。

### 2.2 全局快捷键（可录制自定义）

**方案**：`tauri-plugin-global-shortcut`，Windows/Linux/macOS 支持（不含 Android/iOS）。

```ts
// 前端：注册（默认 Alt+Space，见 §11 PRD v1.1 对齐）
import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';

export async function applyShortcut(combo: string) {
  if (await isRegistered(combo)) await unregister(combo);
  await register(combo, () => window.__APP__.togglePanel());
}
// 录制：监听 window keydown，组装 'Mod+Key' 字符串（如 'Control+Shift+K'）
```

```rust
// 后端也可注册（Rust API）
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};
let s = Shortcut::new(Some(Modifiers::CONTROL), Code::Space);
app.global_shortcut().register(s)?;
```

**可行性**：可行。**坑（重要）**：**Windows 上 `Ctrl+Space` 默认是输入法（IME）切换热键**，与全局快捷键争用，用户可能"按了没反应"或被系统吞掉。缓解：
- 出厂默认组合改为 `Alt+Space`（避开 IME 与 Win+* 系统保留键，且与 uTools 肌肉记忆一致）；`Control+Alt+Space` 作备选；
- `Ctrl+Space` 仍可选，但录制/保存时前端红字提示 IME 冲突并**禁止保存**（对齐 §8 e2e 步骤 9）；
- 此为对原始 brief「默认 Ctrl+Space」的偏离，已请 team-lead 正式 ratification（不阻塞实现，出厂默认=Alt+Space）。

### 2.3 指定浏览器启动（exe + URL，而非仅系统默认）

**方案**：`tauri-plugin-opener` 的 `open_url(url, Some(app))`，`app` 可为 `"chrome"`/`"msedge"`/`"firefox"` 或**完整 exe 路径**。

```ts
import { openUrl } from '@tauri-apps/plugin-opener';
// browserKey 来自设置：'chrome' | 'msedge' | 'firefox' | 'C:\\Program Files\\...\\chrome.exe'
await openUrl(url, settings.defaultBrowser || undefined); // undefined = 系统默认
```

**Capability 白名单**（必须，否则被 ACL 拦截）：
```json
// src-tauri/capabilities/default.json
{ "identifier": "opener:allow-open-url",
  "allow": [ { "url": "**", "app": "chrome" },
             { "url": "**", "app": "msedge" },
             { "url": "**", "app": "firefox" } ] }
```
**可行性**：完全满足"用浏览器 exe + URL 参数唤起"。**坑**：若用户选"自定义 exe 路径"，capability 需改用 exe 路径作用域；实现时把可选浏览器限定为常见三款 + 允许用户从文件选择 exe（经 dialog 插件选路径后写入设置），并在 capability 中用该路径白名单。

### 2.4 窗口拖拽接收链接（文件 / 文本）

**方案**：`tauri.conf.json` 窗口 `dragDropEnabled: true`（默认），前端监听 `onDragDropEvent`：

```ts
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
getCurrentWebviewWindow().onDragDropEvent(({ payload }) => {
  if (payload.type !== 'drop') return;
  for (const p of payload.paths) handleDroppedPath(p); // .html→解析书签; .url/含http→取URL
});
```

**可行性**：文件拖入（含书签 `.html`、`.url` 快捷方式）走 `paths`，可靠。**坑（重要）**：从浏览器地址栏/网页**拖一个超链接**时，WebView2 在 Windows 上常把 URL 以文件或 `text/uri-list` 形式投递，Tauri 的 `paths` 里拿到的是路径字符串而非结构化 URL。缓解（双通道）：
- 通道 A（默认开）：`onDragDropEvent` 处理 `paths`——若是 `.html/.htm` 走书签解析；若是 `.url` 文件读其内容取 URL；若路径本身是 `http(s)://` 开头直接当 URL；
- 通道 B（覆盖纯链接拖拽）：在同一放置区叠加一个 HTML5 `drop` 监听（`dragover`/`drop` + `preventDefault`），用 `event.dataTransfer.getData('text/uri-list')` 取 URL。**注意**：WebView2 在 Windows 下若 `dragDropEnabled:true`，HTML5 DnD 会被 Tauri 拦截——因此纯链接拖拽场景需在该放置区临时 `dragDropEnabled:false`（或在 `tauri.conf.json` 设 `false` 并接受"文件拖入只读到内容而非路径"）。
- **MVP 决策（PRD v1.1 对齐）**：纯链接拖拽已降为增强项（原 F7），移出核心路径；核心路径 =「书签 `.html` 文件拖入 + 手动添加」。F6 增加".html 文件直接拖入窗口触发导入"替代入口（同解析逻辑）。Chrome/Edge 真机拖链接行为在 e2e 阶段用双通道定稿。

### 2.5 书签 HTML 解析

**方案**：浏览器导出的书签为 Netscape Bookmark 标准格式：
```
<DT><A HREF="https://a.com" ADD_DATE="...">站点A</A>
<DT><H3>分类文件夹</H3>
<DL><p> ... </DL>
```
用 `scraper` 解析 `<a href>`（取 URL + 文本为标题）+ `<h3>`（取分类名），按 `<DL>` 嵌套还原层级。纯本地、无网络。

**可行性**：完全可行，零风险。**坑**：Firefox 与 Chrome 导出细节略有差异（属性名大小写、是否含 ICON_URI），解析时大小写不敏感、缺失字段给默认。

### 2.6 favicon / title 在线抓取 + 离线降级

**方案**：Rust 异步命令，复用应用内 `reqwest::Client`（共享、带超时与浏览器 UA）。

```rust
// src-tauri/src/commands/fetch.rs（示意）
#[tauri::command]
pub async fn fetch_meta(url: String, state: tauri::State<AppState>) -> Result<UrlMeta, String> {
    let html = state.http.get(&url).timeout(Duration::from_secs(5))
        .header("User-Agent", BROWSER_UA).send().await
        .and_then(|r| r.text()).await.map_err(|_| "fetch_fail")?;
    let doc = scraper::Html::parse_document(&html);
    let title = doc.select(&Selector::parse("title").unwrap()).next()
        .map(|e| e.text().collect::<String>().trim().to_string()).unwrap_or_default();
    let favicon_url = resolve_favicon(&doc, &url); // 优先 <link rel=icon>，否则 /favicon.ico
    let bytes = state.http.get(&favicon_url).timeout(Duration::from_secs(5))
        .send().await.and_then(|r| r.bytes()).await;
    let saved = match bytes { Ok(b) if b.len() < 2*1024*1024 => save_favicon(state, &url, &b), _ => None };
    Ok(UrlMeta { title, favicon_path: saved }) // None → 前端用 Lucide 默认图标
}
```

**可行性**：可行。**坑**：
- SPA 站点 `<title>` 为占位（如 "Loading…"），属 best-effort，允许用户手动改标题；
- 部分站点按 UA 返回 403，已用浏览器 UA 缓解；
- 抓取为后台任务，限流（信号量 4 并发）、超时 5s、响应体上限 2MB，绝不阻塞 UI；
- 离线/无网络时直接降级默认图标，不弹错。

### 2.7 开机自启

**方案**：`tauri-plugin-autostart`，Windows 写 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`，无需管理员。

```ts
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';
await enable(); // 注册；isEnabled()/disable() 用于设置开关
```

**可行性**：可行，零风险。**坑**：极少数杀软会标记自启注册；属已知噪声，不在 MVP 范围处理。

### 2.8 窗口贴右上角

**方案**：窗口配置 `decorations:false`、`alwaysOnTop:true`、`resizable:true`、`skipTaskbar:true`（仅托盘）；启动时用手动定位（不引入 positioner 插件，减少依赖面）：

```rust
// src-tauri/src/setup 或命令内
let monitor = win.current_monitor()?.ok_or("no-monitor")?;
let scale = win.scale_factor()?;
let margin = 12.0 * scale;
let pos = tauri::PhysicalPosition::new(
    monitor.size().width as f64 - WINDOW_W as f64 - margin, margin);
win.set_position(pos)?;
```

**可行性**：可行。**坑**：必须乘 `scale_factor`（高 DPI 否则偏位）；多屏时 MVP 锚定"主显示器右上角"（如需"光标所在屏"作为增强）；`skipTaskbar` 时务必保证托盘可重新唤出，避免"窗口丢失"。

---

## 3. 版本锚定（Version Pinning）

> 纪律：以下为"意图版本锚"。Rust 依赖的精确 patch 在实现时由 `cargo add` 解析并冻结进 `Cargo.lock`；npm 依赖由 `npm install` 冻结进 `package-lock.json`。任何 API 调用须按冻结版本核对（generated-code-failure-modes §3）。

### Rust 端（src-tauri/Cargo.toml）

| 依赖 | 锚定版本 | 用途 | 备注 |
|------|----------|------|------|
| `tauri` | `2`（解析 2.11.x） | 框架核心 | 2026-07 最新 2.11.5 |
| `tauri-plugin-global-shortcut` | `2.3.2` | 全局快捷键 | crates 最新 2.3.2 |
| `tauri-plugin-opener` | `2.5.2` | 指定浏览器打开 | crates 最新 2.5.2 |
| `tauri-plugin-autostart` | `2.5.1` | 开机自启 | crates 最新 2.5.1 |
| `tauri-plugin-dialog` | `2`（解析最新） | 书签文件选择（沙箱安全） | 替代裸 fs |
| `rusqlite` | `0.32.1`（features=`bundled`） | 本地 SQLite | 内嵌 SQLite 3.46，免系统依赖 |
| `reqwest` | `0.12`（features=`json,gzip,brotli,deflate`） | 抓取 title/favicon | 异步，配 tokio |
| `scraper` | 实现时 `cargo add scraper` 解析最新 | HTML 解析 | 选择器 API 稳定 |
| `tokio` | `1`（features=`full`） | 异步运行时 | |
| `serde` / `serde_json` | `1` | 序列化 | |
| `url` | `2` | URL 解析/拼接 | |

### 前端（package.json）

| 依赖 | 锚定版本 | 用途 |
|------|----------|------|
| `react` / `react-dom` | `18.3.1` | UI 框架（稳定，Tauri 2 兼容佳） |
| `vite` | `5.4.x` | 构建 |
| `@vitejs/plugin-react` | `4.3.x` | React 集成 |
| `typescript` | `5.6.x` | 类型 |
| `@tauri-apps/api` | `2` | Tauri JS API |
| `@tauri-apps/cli` | `2` | 构建/运行 |
| `@tauri-apps/plugin-opener` | `2` | 打开浏览器 |
| `@tauri-apps/plugin-global-shortcut` | `2` | 全局快捷键 |
| `@tauri-apps/plugin-autostart` | `2` | 开机自启 |
| `@tauri-apps/plugin-dialog` | `2` | 文件选择 |
| `zustand` | `4.5.x` | 轻量状态管理 |
| `@tanstack/react-virtual` | `3.x` | 列表虚拟滚动（上千条流畅） |
| **`lucide-react`** | **`1.24.0`**（回退 `0.561.0`） | **SVG 图标库（P0 锁定）** |

### 图标库锁定（P0 强制）

- **锁定 `lucide-react@1.24.0`**（npm 最新 stable；命名导入 API `import { Globe, Plus, ... } from 'lucide-react'` 在 0.x 与 1.x 一致）。若实现期发现 1.x 有重大破坏性变更，回退 `0.561.0`，导入方式不变。
- 全项目**只使用 Lucide 提供的 SVG 图标**，**禁止任何 emoji 作为功能图标**（P0）。
- 图标经统一封装 `components/Icon.tsx` 引用，禁止在业务组件里散落图标 import，便于后续整体替换。

---

## 4. ADR 草案（架构决策记录）

> 存放于 `docs/architecture/adr/`，MADR 格式，状态 Accepted（草案）。

### ADR-001：框架选型 — Tauri 2
- **Status**：Accepted（草案）
- **Background**：需 Windows 本地优先、常驻托盘的小工具；候选 Tauri 2 / Electron / .NET WinForms+WebView2。
- **Decision**：采用 **Tauri 2**。
- **Consequences**：+ 安装包 ≈8–15MB、冷启 <1s、官方插件全覆盖能力、前端复用 React；− 需少量 Rust（薄系统层），插件版本需与 tauri 主版本对齐。

### ADR-002：存储选型 — SQLite（rusqlite bundled）优于 JSON 文件
- **Status**：Accepted（草案）
- **Background**：需管理上千条网址 + 分类，要求崩溃安全、搜索流畅。
- **Decision**：采用 **SQLite**（`rusqlite` + `bundled` 特性，单文件 `app_data_dir/urls.db`，WAL 模式）。
- **Consequences**：+ 事务/崩溃安全（防半写损坏）、索引化搜索（FTS5 可做模糊匹配）、易扩展（分类/标签/点击计数）；− 比 JSON 多一层 schema/迁移，但成本可忽略。
- **否决 JSON 的原因**：JSON 全量读写有半写损坏风险、无并发保护、搜索需全量进内存（上千条虽可接受但非最优）。

### ADR-003：图标库锁定 — lucide-react@1.24.0（禁止 emoji）
- **Status**：Accepted（草案）
- **Background**：P0 要求锁定一套 SVG 图标库，禁止 emoji。
- **Decision**：锁定 **lucide-react@1.24.0**，全项目唯一图标来源；封装 `Icon.tsx`；回退 `0.561.0`。
- **Consequences**：+ 树摇友好、风格统一、与 React 原生契合；− 新增非常规图标需等上游或自绘 SVG。

### ADR-004：打开 URL 由前端直接调用 opener 插件（无额外 Rust 中转）
- **Status**：Accepted（草案）
- **Background**：点击网址需"即时"用指定浏览器打开。
- **Decision**：前端点击即 `openUrl(url, browserKey)`（`@tauri-apps/plugin-opener`），不经 Rust 命令中转，降低延迟。
- **Consequences**：+ 打开延迟 <50ms；− capability 须按浏览器白名单 `app` 作用域配置。

### ADR-005：窗口定位用手动计算，不引入 positioner 插件
- **Status**：Accepted（草案）
- **Background**：需面板贴右上角。
- **Decision**：用 `current_monitor()` + `scale_factor` 手动算主屏右上角坐标，不引入 `tauri-plugin-positioner`。
- **Consequences**：+ 少一个依赖、定位逻辑可控（含 DPI）；− 多屏"光标所在屏"锚定需自行扩展（MVP 不做）。

---

## 5. 初步模块划分（Rust 后端职责 / 前端职责）

### 分层原则（遵循 code-organization）
依赖只能向下：表现层(组件) → 服务层(services，封装 invoke) → 状态层(store) →（经 Tauri 桥）Rust 命令层 → 仓储层(repository) → SQLite。单文件 ≤300 行，按资源/功能分包，入口只装配。

### 目录结构

```
url-launcher/
├── src/                      # 前端（React + TS）
│   ├── main.tsx              # 入口：仅挂载 <App/>
│   ├── App.tsx               # 根组件：装配面板 + 全局监听
│   ├── components/           # 表现层（纯展示 + 事件回调）
│   │   ├── Icon.tsx          # Lucide 图标统一封装（唯一图标出口）
│   │   ├── LauncherPanel.tsx
│   │   ├── SearchBar.tsx
│   │   ├── UrlList.tsx       # 虚拟滚动容器（@tanstack/react-virtual）
│   │   ├── UrlRow.tsx        # 单行：favicon + 标题 + 打开按钮
│   │   ├── CategorySidebar.tsx
│   │   ├── AddUrlDialog.tsx
│   │   ├── ImportDialog.tsx
│   │   └── SettingsDialog.tsx
│   ├── services/             # 服务层：封装 Tauri invoke（唯一后端调用出口）
│   │   ├── urls.ts           # list/add/update/delete/search
│   │   ├── bookmarks.ts      # 导入书签
│   │   ├── settings.ts       # 读写设置/快捷键/浏览器/自启
│   │   └── tauri.ts          # invoke 薄封装 + 错误归一
│   ├── stores/               # 状态层（zustand）
│   │   ├── useUrlStore.ts
│   │   └── useSettingsStore.ts
│   ├── hooks/                # 逻辑钩子
│   │   ├── useGlobalShortcut.ts
│   │   ├── useDragDrop.ts
│   │   └── useDebouncedSearch.ts
│   ├── lib/
│   │   ├── favicon.ts        # 默认图标降级 + 缓存路径解析
│   │   └── design-tokens.css # CSS 变量（颜色/间距），禁止硬编码 hex
│   └── types/                # TS 类型（与 Rust 模型对齐）
│       └── models.ts
└── src-tauri/                # Rust 后端（薄系统层）
    ├── Cargo.toml
    ├── tauri.conf.json       # 窗口/托盘/插件/capability 配置
    ├── capabilities/default.json
    └── src/
        ├── lib.rs            # 入口：仅装配 builder + 插件 + setup（无业务）
        ├── tray.rs           # 托盘构建与事件（§2.1）
        ├── setup.rs          # 初始化 DB/HTTP client/状态、窗口定位
        ├── state.rs          # AppState（Db 连接、reqwest::Client、设置）
        ├── error.rs          # 统一错误 → 前端错误码
        ├── models.rs         # UrlItem / Category / Settings 结构体
        ├── commands/         # Tauri 命令（HTTP 边界，薄）
        │   ├── urls.rs        # CRUD + search（调 repository）
        │   ├── bookmarks.rs   # 书签 HTML 解析 + 批量插入
        │   ├── fetch.rs       # fetch_meta（§2.6）
        │   ├── settings.rs    # get/set 设置
        │   └── autostart.rs   # 自启开关（调插件）
        ├── db/
        │   ├── connection.rs  # 打开 SQLite（bundled, WAL）
        │   ├── migrations.rs  # schema 建表（urls/categories/settings）
        │   └── repositories/  # 数据访问（只读写，无业务）
        │       ├── url_repo.rs
        │       └── category_repo.rs
        └── bookmarks/parse.rs # Netscape 书签格式解析
```

### 职责边界
- **Rust 负责**：系统能力（托盘/快捷键/打开浏览器/自启/拖拽事件桥接）、本地持久化（SQLite）、网络抓取（title/favicon）、书签解析、文件沙箱（经 dialog 插件）。所有命令保持"薄"——参数校验 + 调 repository/service + 返回数据。
- **前端负责**：UI 渲染、搜索交互（防抖/虚拟滚动）、设置界面、拖拽落点 UI、图标渲染、状态管理、直接调用 opener 打开 URL（§ADR-004）。
- **禁止**：Rust 命令里写 HTML/UI 逻辑；前端直接 `fetch` 本地 DB（必须经 services→invoke）；cross-layer 直连。

---

## 6. 关键约束

### 6.1 性能目标（上千条网址流畅）
- **存储/查询**：SQLite 索引化；搜索用 `LIKE` 参数化查询（标题/URL）或 FTS5；返回**分页**（默认 limit 200，滚动加载更多），不全量返回。
- **前端渲染**：`@tanstack/react-virtual` 虚拟滚动，仅渲染可视行（~30 行）；搜索输入**防抖 120ms**。
- **抓取不阻塞**：favicon/title 抓取在后台，信号量限 4 并发、超时 5s、响应 ≤2MB；完成后增量更新对应行，UI 不卡。
- **打开即时**：点击 → 前端直接 `openUrl`，目标 <50ms。
- **容量量级**：数千条时 DB 查询 <5ms、内存过滤 <10ms、渲染恒定；满足"上千条流畅"。**P0 基线 = 2000 条搜索到渲染 <200ms**（对齐 PRD v1.1）；万级列为压测目标，不卡 MVP。

### 6.2 安全（本地文件权限 / 注入 / ACL）
- **本地优先、无网络服务**：不监听任何端口，不暴露本地 HTTP 服务。
- **文件权限最小化**：应用仅写 `app_data_dir`（`urls.db`、`favicons/`）；书签导入经 `@tauri-apps/plugin-dialog` 文件选择，不开放裸 fs 任意路径。
- **SQL 参数化**：rusqlite 全部使用命名参数（`?`/`:name`），**严禁字符串拼接**（防注入，即便本地也守住纪律）。
- **favicon 防 XSS**：抓取的图标仅以二进制字节存储，前端用 `<img src={objectURL}>` 渲染，**绝不**以 HTML/`innerHTML` 注入；对二进制做格式/MIME 校验。
- **Capability 最小权限**：opener 仅白名单 `chrome/msedge/firefox`（及用户自定义 exe 路径）；global-shortcut 仅 `allow-register/unregister`；autostart 仅 `enable/disable/is_enabled`；dialog 仅读文件。
- **书签 HTML 解析**：按文本解析，结果仅取 `href`+文本，不执行其中任何脚本。

### 6.3 设计约束（P0）
- **图标库锁定**：全项目唯一使用 `lucide-react@1.24.0`，经 `Icon.tsx` 封装；**禁止 emoji 作为功能图标**。
- **禁止硬编码颜色值**：除 `#fff` / `#000` 外，所有颜色走 `lib/design-tokens.css` 的 CSS 变量（如 `--color-bg`、`--color-surface`、`--color-accent`、`--color-text`）；组件/样式中不得出现裸 hex/rgb。
- 设计 token 由 designer 在 `design-tokens.css` 中定义并维护，前后端一致引用。

### 6.4 已知坑清单（内嵌，实现前必读）
1. **IME 冲突**：`Ctrl+Space` 在 Windows 是输入法切换键，默认快捷键须避开或强提示改键（§2.2）。
2. **链接拖拽 MIME 歧义**：WebView2 把拖入的 URL 可能以文件或文本投递，需双通道处理（§2.4）。
3. **WebView2 运行时**：Win10/11 大多已预装；极少数缺失时需引导用户安装（安装包可勾选 bundled WebView2 引导）。
4. **DPI 定位**：窗口定位必须乘 `scale_factor`，否则高 DPI 屏偏位（§2.8）。
5. **SPA 站点标题占位**：`<title>` 可能无价值，允许用户手动编辑（§2.6）。
6. **skipTaskbar 丢窗**：`skipTaskbar:true` 时必须保证托盘可重新唤出（§2.8）。
7. **插件版本对齐**：所有 `tauri-plugin-*` 须与 `tauri` 2.x 主版本一致，否则编译失败。

---

## 7. 范围（Out-of-Scope，本次不做）
- 跨平台（macOS/Linux）——仅 Windows。
- 后端/云同步/多设备同步——本地优先，零后端。
- 账号系统、登录、分享。
- 网址内容预览/截图、历史访问统计报表。
- 多屏"光标所在屏"锚定（MVP 锚定主屏右上角）。
- AI 智能分类/去重（后续迭代）。
- 主题换肤引擎（MVP 提供一套浅色 token，深色作为增强）。
- 纯链接拖拽（原 F7）——已降为增强项，移出 MVP 核心路径（§11 / §2.4）。

---

## 8. 端到端验证步骤（E2E，收尾即验收）

> 覆盖核心成功流 + 关键错误/边界流。实现完成后逐条跑通方可判架构落地。

**核心成功流**
1. `npm run tauri dev` 启动，确认托盘图标出现、面板默认隐藏。
2. 按全局快捷键（`Alt+Space` 默认）→ 面板贴主屏右上角出现；再按隐藏。
3. 手动添加一条网址（如 `https://github.com`）→ 自动抓取标题+ favicon 并显示；点击"打开"→ 用设置中指定浏览器（如 msedge）打开该 URL。
4. 导入一份 Chrome 书签 `.html` → 分类与网址正确入库，列表可搜索、可滚动（灌入 2000 条验证流畅）。
5. 从浏览器拖一个书签 `.html` 文件进窗口 → 正确导入（双通道验证，纯链接拖拽为增强项）；F6 的".html 文件直接拖入触发导入"入口同解析逻辑。
6. 设置里开启"开机自启" → 重启系统后应用自动启动且托盘出现。

**关键错误/边界流**
7. 断网状态下添加网址 → 标题留空、favicon 降级为 Lucide 默认图标，**不崩溃、不弹错**。
8. 抓取一个返回 403 / 超时(>5s) 的站点 → 超时降级默认图标，UI 不卡。
9. 尝试把全局快捷键设为 `Ctrl+Space` → 前端提示 IME 冲突，禁止保存。
10. capability 未白名单的浏览器（如 `opera`）→ 打开被 ACL 拦截并返回明确错误，而非静默失败。
11. 数据库文件损坏模拟（删 `urls.db` 行中段）→ 下次启动 migrations 重建/容错，不白屏。

**性能断言**
12. 库内 2000 条时，搜索输入到结果渲染 <200ms（含防抖）；滚动帧率稳定。

---

## 9. 成本与排期（依据 development-costs 桌面端工具）
- **类型**：桌面端工具类 MVP。
- **周期**：4–6 周。
- **人月**：2–3 人月（前端 React 为主，Rust 薄层约占 20–30%）。
- **技术栈**：Tauri 2 + React 18 + SQLite(rusqlite) + Lucide。
- **隐性成本**：无服务器/云费用（本地优先）；WebView2 运行时若缺失需用户安装（一次性）；无订阅/域名费用。
- **AI 辅助提速**：参考模型可压缩至 2–3 周（需求/UI/前后端开发提速 2–3x）。

---

## 10. 给协作方的约束传递
- **→ designer**：图标唯一来源 `lucide-react@1.24.0`，禁止 emoji；颜色全部走 `lib/design-tokens.css` CSS 变量，禁止硬编码 hex（除 `#fff`/`#000`）；面板贴右上角、无标题栏、置顶。
- **→ pm**：默认快捷键建议改为 `Alt+Space`（避开 Windows IME 的 `Ctrl+Space`）；范围为 Windows-only、本地优先、无后端；"纯链接拖拽"为增强项，核心路径是书签文件/网址手动添加。
- **→ team-lead**：本方案为自包含契约（已点名文件/接口/版本/坑/e2e），可直接进入 Phase 2（前端/后端实现）；若采纳 Tauri 2，请确认团队 Rust 学习成本可接受（薄层，预计 1–2 天上手）。

---

## 11. 契约对齐记录（PRD v1.1）
- 日期 2026-08-02；pm 采纳 §0/§2/§6 的三项评审，PRD 更新至 v1.1（新增 §13 修订记录）。本文档与 PRD 互为契约。
- 决策对齐（与本文档已写条款一致，此处仅作锁定点）：
  1. **默认全局快捷键 = `Alt+Space`**（避开 Windows IME 的 `Ctrl+Space`）；`Ctrl+Space` 仍可选，但录制/保存时前端红字提示 IME 冲突并禁止保存（对齐 §2.2 与 §8 e2e 步骤 9）。注：此为对原始 brief「默认 Ctrl+Space」的偏离，已请 team-lead 正式 ratification；**不阻塞实现**（出厂默认=Alt+Space）。
  2. **纯链接拖拽降为增强项**（原 F7），移出 MVP 核心路径；核心路径 =「书签 .html 文件拖入 + 手动添加」。F6 增加".html 文件直接拖入窗口触发导入"替代入口（同解析逻辑）。Chrome/Edge 真机拖链接行为在 e2e 阶段用双通道（Tauri `paths` + HTML5 `dataTransfer`）定稿（对齐 §2.4）。
  3. **性能基线 = 2000 条搜索到渲染 <200ms（P0）**，对齐 §6.1/§8；万级列为压测目标，不卡 MVP。
- 状态：**可进入实现阶段（Phase 2）**。
