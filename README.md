# 网址板 / Linkdeck

> Windows 桌面端纯网址启动器 · 系统托盘常驻 · 全局快捷键秒开

**Linkdeck**（项目代号 `url-launcher`）是一款**本地优先、零配置、单点聚焦**的桌面书签管理工具。与 uTools / Quicker 等"万能启动器"不同，Linkdeck 只做一件事——把分类网址以最轻量的方式放在指尖：按下快捷键，搜索或点击，立即用指定浏览器打开。

由 [Tauri 2](https://v2.tauri.app) 驱动，内存常驻 < 80MB，启动 < 200ms，万级书签经虚拟滚动流畅浏览。

<p align="center">
  <img src="full-screen.png" alt="Linkdeck 主面板截图" width="720">
</p>

## 特性

- **全局唤出** — `Ctrl+Alt+Space`（可自定义），托盘常驻，即按即出，再按即隐
- **分类管理** — 无限层级（MVP 暂为单层），拖拽排序，增删改查
- **实时搜索** — 对标题 / URL / 分类名做模糊过滤，2000 条 < 200ms
- **指定浏览器打开** — 支持 Chrome / Edge / Firefox / 系统默认 / 自定义路径
- **书签 HTML 导入** — 解析 Chrome / Edge / Firefox 导出的 Netscape 书签文件，文件夹自动映射为分类
- **浏览器拖拽** — 支持 `.html` 书签文件拖入 + `text/uri-list` 超链接拖入（双通道）
- **自动抓取** — 新增网址时自动抓取标题 + favicon，离线降级默认图标
- **数据导出** — 分类 / 网址一键导出 JSON，本地备份或分享
- **开机自启** — 可选（设置中开关）
- **快捷键自定义** — 所有快捷键可自由录制，IME 冲突检测（`Ctrl+Space` 红字警告）

### 不做

- ❌ 云同步 / 多设备 / 账号体系
- ❌ 内嵌浏览器 / 网页快照
- ❌ macOS / Linux（仅 Windows 10 / 11）
- ❌ 插件生态 / 自动化工作流

## 技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| 桌面框架 | [Tauri](https://v2.tauri.app) | 2.11.5 |
| 后端 | Rust（stable ≥ 1.78） | — |
| 数据库 | [rusqlite](https://github.com/rusqlite/rusqlite) (bundled) | 0.32.1 |
| 前端 | React | 18.3.1 |
| 构建 | Vite | 5.4.x |
| 语言 | TypeScript | 5.6.x |
| 状态管理 | [zustand](https://github.com/pmndrs/zustand) | 4.5.x |
| 图标库 | [lucide-react](https://lucide.dev) | 1.24.0 |
| 虚拟滚动 | [@tanstack/react-virtual](https://tanstack.com/virtual) | 3.x |

### 架构亮点

```
┌─────────────────────────────────────────────────────────┐
│                    Tauri 2 双层架构                        │
│                                                         │
│  ┌────────────────────┐       ┌──────────────────────┐  │
│  │  Rust 后端（系统层）  │       │  React/TS 前端（UI层） │  │
│  │                     │       │                       │  │
│  │  · 系统托盘 (tray)   │ ◄──►  │  · 面板/对话框组件     │  │
│  │  · 全局快捷键        │ IPC   │  · Zustand 状态管理    │  │
│  │  · SQLite 读写       │       │  · 虚拟滚动列表        │  │
│  │  · favicon 网络抓取  │       │  · 搜索防抖            │  │
│  │  · 书签 HTML 解析    │       │  · 拖拽解析            │  │
│  │  · 拖拽双通道解析    │       │  · 浏览器 opener 直开  │  │
│  └────────────────────┘       └──────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

- **安全**：仅允许 `http/https` 协议（`ensure_safe_url` 强校验）；参数化 SQL 禁止拼接
- **隐私**：零遥测 / 无第三方分析 / 所有数据存本地 `%APPDATA%/dev.url-launcher/`
- **性能**：favicon 抓取限 4 并发、5s 超时、2MB 上限

## 快速开始

### 前置条件

| 工具 | 要求 | 验证 |
|------|------|------|
| Rust | stable ≥ 1.78 | `rustc --version` |
| MSVC Build Tools | VS 2022 + C++ 工作负载 | `where link.exe` |
| Node.js | ≥ 18 LTS | `node -v` |
| WebView2 | Win10/11 预装 | — |

### 构建运行

```bash
# 1. 安装前端依赖
npm install

# 2. 类型检查（可选）
npm run typecheck

# 3. 开发模式（热重载）
npm run tauri dev

# 4. 生产构建（产出 .exe 安装包）
npm run tauri build
```

输出位置：

```
src-tauri/target/release/bundle/nsis/网址板_0.1.0_x64-setup.exe
src-tauri/target/release/bundle/msi/网址板_0.1.0_x64_en-US.msi
src-tauri/target/release/url-launcher.exe
```

> 完整构建指南见 [BUILD.md](./BUILD.md)

## 项目结构

```
├── src-tauri/                  # Rust/Tauri 后端
│   ├── Cargo.toml              # Rust 依赖
│   ├── tauri.conf.json         # Tauri 配置
│   ├── icons/                  # 应用图标
│   ├── db/migrations/          # SQLite 迁移
│   └── src/
│       ├── main.rs             # 入口
│       ├── lib.rs              # 核心装配
│       ├── commands/           # IPC 命令（20 个）
│       ├── db/repositories/    # 数据访问层
│       ├── bookmarks/          # Netscape 书签解析
│       ├── tray.rs             # 系统托盘
│       ├── dragdrop.rs         # 拖拽解析（双通道）
│       └── shortcut.rs         # 快捷键校验
├── src/                        # React/TypeScript 前端
│   ├── components/             # UI 组件
│   ├── services/               # IPC 调用封装
│   ├── stores/                 # Zustand 状态
│   ├── hooks/                  # 自定义 Hook
│   ├── lib/                    # favicon 回退 + CSS Token
│   └── types/                  # 类型定义
├── scripts/gen-icons.mjs       # 图标生成脚本
├── tokens.css                  # 设计 Token
├── design-tokens.json          # Token JSON 定义
├── spec.md                     # 规格契约（13 章）
├── PRD.md                      # 产品需求文档
├── DESIGN.md                   # UI/UX 设计规约
├── DESIGN-PAGES.md             # 组件级实现规约
├── BUILD.md                    # 构建指南
├── openapi.yaml                # OpenAPI 3.0 IPC 契约
└── docs/                       # 架构文档 / ADR / QA
    └── architecture/
        ├── ARCHITECTURE.md
        └── adr/                # 架构决策记录（ADR-001 ~ 005）
```

## 文档

| 文档 | 内容 |
|------|------|
| [PRD.md](./PRD.md) | 产品需求、竞品分析、RICE 评分、验收标准 |
| [spec.md](./spec.md) | 规格契约（13 章，锁定范围 / API / Token / 验收） |
| [DESIGN.md](./DESIGN.md) | UI/UX 设计规范（配色 / 间距 / 图标 / 交互） |
| [DESIGN-PAGES.md](./DESIGN-PAGES.md) | 组件级实现规约（每组件「外观 / 行为 / 验收」） |
| [BUILD.md](./BUILD.md) | 本地构建指南 + 常见问题排查 |
| [openapi.yaml](./openapi.yaml) | OpenAPI 3.0 IPC 接口契约 |
| [docs/architecture/ARCHITECTURE.md](./docs/architecture/ARCHITECTURE.md) | 系统架构文档 |
| [docs/architecture/adr](./docs/architecture/adr) | 架构决策记录（ADR-001 ~ 005） |

## 安全

- **URL 校验**：仅允许 `http://` / `https://`，防命令注入
- **SQL 安全**：全部使用命名参数，禁止字符串拼接
- **网络请求**：4 并发信号量、5s 超时、2MB 响应上限
- **隐私**：零遥测、无第三方分析代码、数据纯本地存储
- **窗口定位**：手动锚定右上角，不依赖系统窗口 API

## 许可证

MIT © RiMuLiGZF