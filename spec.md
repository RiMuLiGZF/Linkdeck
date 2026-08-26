# Spec - url-launcher v0.1.0

> 生成日期：2026-08-02
> 基于：PRD v1（许清楚）+ 架构方案 v1（高见远）+ 设计方向 v1（颜好看）
> 状态：已确认（用户于 2026-08-02 确认三文档；2026-08-06 默认快捷键由 Alt+Space 改为 Ctrl+Alt+Space）
> 流程定位：Phase 1.5 规格契约。后续设计 / 开发 / 测试均以本文件为唯一依据。

---

## 1. 产品定义
- **一句话描述**：Windows 桌面端"网址启动器 / 书签收纳面板"——托盘常驻 + 全局快捷键唤出，分类管理大量网址、实时搜索、点击用指定浏览器直接打开。
- **目标用户**：Windows 重度用户（开发者 / 运维 / 运营 / 研究者 / 效率爱好者），常用网址 100~1000+，讨厌账号 / 订阅 / 臃肿启动器。
- **核心问题**：现有方案要么太重（万能启动器 + 插件），要么太云（账号 + 订阅 + 联网），要么太简（原生书签无搜索）。用户要一个本地优先、零配置、按下快捷键秒开分类网址的纯面板。

## 2. MVP 范围（锁定——MVP 落地集 F1–F6 + F8；F7 纯链接拖拽降为 P2 增强，待 e2e 实测定稿；不在此列表的功能一律不做）

| 优先级 | 功能 | 验收标准摘要 | RICE |
|--------|------|--------------|------|
| P0 | F1 全局快捷键唤出 + 托盘常驻 | Ctrl+Alt+Space 唤出右上角面板，焦点在搜索框，托盘有常驻图标 | 15.0 |
| P0 | F2 网址分类管理（增删改 / 拖拽排序） | 分类可建 / 改名 / 删 / 拖拽排序，每类可设颜色 | 6.7 |
| P0 | F3 实时搜索 / 过滤 | 输入关键词实时过滤（标题/URL/分类），键盘可达 | 10.0 |
| P0 | F4 点击用指定浏览器直开 | 按设置用指定浏览器（或系统默认）打开 URL，面板自动隐藏 | 20.0 |
| P0 | F5 手动添加网址 | 仅 URL 必填，可填标题 / 分类 | 10.0 |
| P1 | F6 书签 HTML 导入（含 .html 文件拖入窗口） | 解析 Chrome/Edge/Firefox 导出，按文件夹映射分类，批量入库去重；支持将 .html 文件拖入窗口触发导入 | 3.2 |
| P2 | F7 从浏览器纯链接拖拽添加（增强项） | 纯链接拖拽（MIME 歧义待 e2e 实测）；.html 文件拖入窗口已并入 F6 | 2.8 |
| P1 | F8 自动抓标题 + favicon + 离线降级 | 新增时抓标题/favicon，失败/离线用默认图标与 URL 作标题 | 2.4 |

## 3. 明确不做（Out-of-Scope — 锁定）
| 不做的功能 | 原因 | 何时考虑 |
|------------|------|----------|
| 云同步 / 多设备 | 无账号体系，本地优先定位 | v2（需服务端） |
| 登录账号 / 会员订阅 | 违背零配置本地优先 | 永不（产品定位） |
| 内嵌浏览器 | 一律外部打开，避免范围膨胀 | 永不 |
| macOS / Linux / 移动端 | 仅 Windows 目标 | v2 |
| 插件生态 / 自动化工作流 | 不做瑞士军刀 | 永不 |
| 全文存档 / 网页快照 | 区别于 Raindrop | 永不 |
| 团队协作 / 共享编辑 | 仅本地导出 JSON 分享 | v2 |
| 深色主题 / 使用统计 | 资源聚焦核心闭环 | Backlog P2 |

## 4. 技术架构（锁定 — 含版本锚定）
| 层 | 技术 | 实际版本 | 锁定原因 |
|----|------|----------|----------|
| 框架 | Tauri | 2.11.5（rust） | 体积~10MB、常驻<80MB，远轻于 Electron |
| 前端框架 | React | 18.3.1 | 团队 Web 栈，复用生态 |
| 前端构建 | Vite | 5.4.x | 快，HMR 友好 |
| 前端语言 | TypeScript | 5.6.x | 类型安全 |
| 图标库 | lucide-react | 1.24.0（回退 0.561.0） | P0 锁定唯一 SVG 图标库，禁 emoji |
| 状态管理 | zustand | 4.5.x | 轻量，适合面板态 |
| 虚拟列表 | @tanstack/react-virtual | 3.x | 上千条流畅滚动 |
| 存储 | rusqlite（bundled SQLite 3.46） | 0.32.1 | 防半写损坏、索引搜索、易扩展 |
| 打开浏览器 | tauri-plugin-opener | 2.5.2 | open_url(url, app) 指定浏览器 |
| 全局快捷键 | tauri-plugin-global-shortcut | 2.3.2 | Windows 支持，可录制 |
| 开机自启 | tauri-plugin-autostart | 2.5.1 | HKCU\Run，无需管理员 |
| 文件选择 | tauri-plugin-dialog | 2 | 书签导入沙箱 |
| HTTP/解析 | reqwest 0.12 + scraper | 0.12 | favicon/title 抓取、书签解析 |
| 后端运行时 | Rust + Tokio | 1（full） | Tauri 2 原生 |

## 5. API 端点清单（锁定——Tauri invoke 命令，开发时以此为唯一依据）
> 前端经 `invoke(command, args)` 调用。前端直接调 opener 插件打开 URL（ADR-004，无 Rust 中转）。

| Command | 参数 | 返回 | 说明 |
|---------|------|------|------|
| `urls_list` | `{categoryId?, search?, limit?}` | `Url[]` | 列表/搜索，默认 limit 200 |
| `url_create` | `{url, title?, categoryId?, note?}` | `Url` | 手动添加，触发后台 fetch_meta |
| `url_update` | `{id, title?, categoryId?, note?}` | `Url` | 编辑 |
| `url_delete` | `{id}` | `void` | 删除 |
| `url_refresh_meta` | `{id}` | `Url` | 手动刷新标题/favicon |
| `categories_list` | `{}` | `Category[]` | 含计数 |
| `category_create` | `{name, color?, icon?}` | `Category` | — |
| `category_update` | `{id, name?, color?, icon?, sort?}` | `Category` | — |
| `category_delete` | `{id}` | `void` | 级联：其下链接归"未分类" |
| `category_reorder` | `{orderedIds[]}` | `void` | 拖拽排序 |
| `bookmarks_import` | `{path}` | `{imported, skipped}` | 解析 Netscape 书签 HTML |
| `fetch_meta` | `{url}` | `{title, faviconPath?}` | 在线抓标题/favicon，超时5s降级 |
| `settings_get` | `{}` | `Settings` | 含 hotkey / defaultBrowser / autostart |
| `settings_set` | `Settings` | `void` | 持久化 |
| `autostart_enable` / `autostart_disable` / `autostart_is_enabled` | `{}` | `bool` | 开机自启 |
| `panel_toggle` | `{}` | `void` | 全局快捷键触发，由 Rust 侧调用前端 |

架构师须同步产出 `openapi.yaml`（OpenAPI 3.0 风格描述上述命令，供前端生成 TS 类型）。

## 6. 数据库表清单（锁定）
| 表名 | 核心字段 | 索引 | 关联 |
|------|----------|------|------|
| `categories` | `id TEXT PK, name TEXT NOT NULL, sort INT DEFAULT 0, color TEXT, icon TEXT, created_at TEXT` | `idx_categories_sort(sort)` | 1:N links |
| `links` | `id TEXT PK, title TEXT, url TEXT NOT NULL, category_id TEXT NULL, note TEXT, favicon_path TEXT NULL, created_at TEXT` | `idx_links_category(category_id)`, `idx_links_url(url)` | N:1 categories |
| `settings` | `key TEXT PK, value TEXT` | — | KV 存储 |

favicon 二进制存于 `app_data_dir/favicons/{sha1(url)}.png`，不在 DB 内。删除链接时一并清理。

## 7. 页面清单（锁定）
| 页面 | 形态 | 核心组件 | 对应功能 | 设计 Token 主题 |
|------|------|----------|----------|-----------------|
| LauncherPanel | 右上角无标题栏置顶浮窗（520×min(720,88vh)） | SearchBar / CategorySidebar / UrlList / UrlRow / FooterAddBar | F1/F2/F3/F4 | 浅色（design-tokens） |
| AddUrlDialog | 模态弹窗 | 名称/URL/分类 输入 | F5 | 浅色 |
| ImportDialog | 模态弹窗 | 文件选择 / 进度 / 结果 | F6 | 浅色 |
| SettingsDialog | 模态弹窗 | 快捷键录制 / 浏览器选择 / 自启开关 / 数据导入导出 | F1(改键)/F4(浏览器) | 浅色 |
| EmptyState | LauncherPanel 内嵌 | 引导添加 / 导入入口 | — | 浅色 |

## 8. 设计 Token（锁定）
> 设计师已产出 `design-tokens.json` + `tokens.css`，前端 `import` 引用。以下为基调，禁止硬编码 hex（除 `#fff`/`#000`）。

- **主色 / 强调色**：`--accent: #3B5BDB`（墨蓝，刻意避开紫粉与 Tailwind 默认靛）
- **背景**：`--bg: #F3F4F6`（桌面底）/ `--surface: #FFFFFF`（浮窗）/ `--surface-warm: #F5F6F8`（凹陷面）
- **文本**：`--fg: #1B1D23` / `--fg-2: #3C3F47` / `--muted: #6B7280` / `--meta: #9AA0A8`
- **边框**：`--border: #E6E8EC` / `--border-soft: #F0F1F4`
- **语义色**：`--success: #1F9D55` / `--warn: #C2810B` / `--danger: #E5484D`
- **字体**：`Inter` + `Noto Sans SC`（中文回退）；等宽 `JetBrains Mono` / `Geist Mono`（URL/快捷键/计数）
- **图标库**：Lucide，16px（行内/侧栏）/ 20px（按钮内/搜索框）/ 24px（独立），stroke 2，继承 currentColor
- **圆角**：浮窗 16px，控件 8~10px
- **动效**：150–200ms `cubic-bezier(0.2,0,0,1)`，尊重 `prefers-reduced-motion`
- **强调色纪律**：每屏可见 accent 装饰性使用 ≤2 处（主添加按钮 + 选中项 + 聚焦环）；favicon 自带色不计入

## 9. 验收标准（锁定——EARS 格式，QA 测试唯一依据）
| 编号 | 功能 | EARS 验收标准 | 优先级 |
|------|------|---------------|--------|
| AC-01 | 唤出 | When 用户按 Ctrl+Alt+Space，系统**必须**在右上角显示面板并将焦点置于搜索框 | P0 |
| AC-02 | 唤出 | While 面板已显示，When 用户再次按 Ctrl+Alt+Space 或点击关闭，系统**必须**隐藏面板 | P0 |
| AC-03 | 托盘 | When 应用启动，系统**必须**在系统托盘显示常驻图标且左键可切换面板 | P0 |
| AC-04 | 搜索 | When 用户在搜索框输入关键词，系统**必须**在 50ms 内实时过滤仅显示匹配标题/URL/分类的条目 | P0 |
| AC-05 | 打开 | When 用户点击某条目（或回车），If 设置了指定浏览器，系统**必须**用该浏览器打开 URL 并隐藏面板 | P0 |
| AC-06 | 打开 | If 未设置指定浏览器，系统**必须**用系统默认浏览器打开 URL | P0 |
| AC-07 | 添加 | When 用户仅填 URL 确认，系统**必须**创建条目并后台抓取标题/favicon | P0 |
| AC-08 | 降级 | If 抓取超时(>5s)或失败或离线，系统**必须**用默认图标与 URL 作为标题，不得崩溃 | P0 |
| AC-09 | 导入 | When 用户选择 Bookmarks.html 导入，系统**必须**解析并按文件夹映射分类批量入库且去重 | P1 |
| AC-10 | 拖拽 | When 用户将书签 .html 文件拖入窗口，系统**必须**触发导入流程；纯链接拖拽为 P2 增强项，不计入 MVP 验收 | P1 |
| AC-11 | 分类 | When 用户新建/改名/删除/拖拽排序分类，系统**必须**持久化且 UrlList 即时反映 | P0 |
| AC-12 | 空态 | When 无数据，系统**必须**显示空状态引导（添加/导入入口），不得白屏或报错 | P0 |
| AC-13 | 稳定 | While 应用常驻 8 小时，系统**必须**保持内存稳定且无自动退出 | P0 |
| AC-14 | 自启 | If 用户开启开机自启，When 系统重启，系统**必须**自动启动并常驻托盘 | P1 |
| AC-15 | 安全 | When 打开 URL，系统**必须**仅允许 http/https scheme，拒绝命令注入 | P0 |

## 10. 边界与约束
- 仅支持 Windows 10 / 11；不兼容 IE。
- 响应式：浮窗宽 520px 固定，高 `min(720px, 88vh)`；列表超长走虚拟滚动。
- 性能目标：唤出 <200ms；1000 条搜索过滤 <50ms；2000 条滚动帧率稳定；打开 <50ms。
- URL 超长截断显示；分类名空/重名处理；同一 URL 多次添加去重或提示已存在。
- 导入大文件（>5000 条）显示进度，不卡死 UI。
- 权限：仅写 `app_data_dir`；无浏览器可选时回退系统默认；无写入权限时提示数据目录不可写。

## 11. 内嵌已知坑（从架构师方案拉取）
| 坑 | 技术栈指纹 | 根因 | 修法 |
|----|------------|------|------|
| 全局快捷键 IME 冲突 | tauri-plugin-global-shortcut + Windows | Ctrl+Space 是输入法切换键；Alt+Space 是 Windows 系统菜单快捷键，易被其它软件占用 | 默认 Ctrl+Alt+Space；录制时检测系统保留组合并禁止保存 |
| 链接拖拽 MIME 歧义 | WebView2 drag-drop | 浏览器拖链接常投为文件/文本 | 双通道：dragDropEnabled 处理 paths + HTML5 drop 取 text/uri-list |
| DPI 定位偏位 | Windows 高 DPI | 未乘 scale_factor | 定位乘 `scale_factor` |
| SPA title 占位 | reqwest + scraper | SPA 首屏无 title | best-effort，允许手改 |
| skipTaskbar 丢窗 | Tauri window | 任务栏不可见 | 托盘必须可重新唤出 |
| WebView2 运行时缺失 | Windows | 目标机未装 WebView2 | 安装包引导或自带运行时 |
| 插件版本对齐 | Tauri 2.x 插件生态 | 插件须与 tauri 2.x 对齐 | Cargo.toml / package.json 版本冻结 |

## 12. 端到端验证步骤（Spec 锁定）
```bash
# 1. 开发启动（需 Rust + WebView2 环境）
npm run tauri dev
# 断言：托盘图标出现，按 Ctrl+Alt+Space 右上角面板弹出

# 2. 核心成功流
# - 手动添加 github.com → 自动抓标题+favicon，入库默认分类
# - 搜索 "git" → 实时过滤仅显示匹配项，回车用指定浏览器打开，面板隐藏
# - 导入 Chrome Bookmarks.html → 分类批量入库，灌 2000 条滚动流畅

# 3. 关键错误流
# - 断网添加 → 降级默认图标不崩
# - 设 Ctrl+Space → 提示 IME 冲突禁止保存
# - 损坏 db → 容错不白屏
```

## 13. 变更记录
| 日期 | 变更内容 | 原因 | 影响范围 |
|------|----------|------|----------|
| 2026-08-02 | 初始 Spec 锁定 | 用户确认三文档 + Alt+Space 默认 | 全域 |
| 2026-08-06 | 默认快捷键 Alt+Space → Ctrl+Alt+Space | Alt+Space 与 Windows 系统菜单/其它软件冲突 | F1/AC-01/AC-02/§11/§12 |
| 2026-08-02 | MVP 范围同步 PRD v1.1 | F7 纯链接拖拽降 P2 增强（MIME 歧义待 e2e）；F6 含 .html 拖入窗口；性能基线对齐 | 第2/9/10节 |
