# url-launcher v0.1.0 — Phase 4 验收核对报告（静态代码核对）

> 报告类型：**静态代码核对（code-evidence review）**
> 核对依据：`spec.md` 第 9 节 AC-01 ~ AC-15（EARS）
> 核对日期：2026-08-03
> 核对人：QA（严过关）

---

## 1. 方法论声明（必读）

**本报告不是运行时测试报告。** 请勿把本文中的任何结论理解为"测试通过"。

| 项目 | 实际情况 |
|------|----------|
| Rust 侧编译验证 | **未执行**。本机当前无 Rust/cargo 工具链，`cargo build` / `cargo check` / `cargo test` 一律**未运行** |
| Rust 单元测试（`shortcut.rs` 内 4 个 `#[test]`） | **未运行**，通过率未知 |
| Tauri 应用启动 / e2e | **未运行** |
| 前端类型检查 | **已实际执行**，见下方原始输出 |
| 前端构建 `npm run build` | **未执行**（沙箱 safe-delete 限制会在清空 dist 时假失败，按环境约束跳过） |
| 书签解析树形状 | **已用规范等价解析器实测**，见 §2 AC-09 证据 |

### 1.1 已实际执行的命令与原始输出

```
$ cd C:/项目/网址板 && npx tsc --noEmit
### npx tsc --noEmit ###
EXIT=0
```

结论：前端 TypeScript 零类型错误（无任何 stdout/stderr 输出，退出码 0）。

```
$ npm install parse5 --no-save   # 仅用于验证 HTML5 树构造，package.json 未被修改
$ node docs/qa/_probe_bookmark_tree.mjs

== 第一个 <dl> 的元素子节点 ==
  <p> -> 元素子节点: []
  <dt> -> 元素子节点: [h3, dl, p]
  <dt> -> 元素子节点: [a]

== 判定 ==
文件夹 <dl> 是 <dt> 的子节点?  true
文件夹 <dl> 是 <dt> 的后继同级节点?  false

parse.rs 的 dt.next_siblings() 搜索结果:  未找到（folder 内所有书签会被丢弃）
```

（探针脚本保留于 `docs/qa/_probe_bookmark_tree.mjs`，可复现。parse5 与 Rust 侧 `html5ever` 同为 HTML Standard 树构造算法实现，形状预期一致；Rust 侧仍须运行时复验。）

### 1.2 状态取值定义

| 取值 | 含义 |
|------|------|
| `代码已实现（待运行验证）` | 找到完整实现落点，静态未见缺陷，但未运行验证 |
| `部分实现` | 有实现落点，但存在明确的缺失环节或已识别缺陷 |
| `未实现` | 未找到实现落点 |
| `无法静态判定` | 该 AC 本质上只能运行时观测（时序、内存、系统交互） |

---

## 2. AC 逐条核对表

| AC | 验收标准摘要 | 状态 | 证据（文件:行号） | 备注 |
|----|--------------|------|-------------------|------|
| AC-01 | 按 Alt+Space 在右上角显示面板，**焦点置于搜索框** | **部分实现** | 唤出链路：`src-tauri/src/lib.rs:70-76`（启动注册 hotkey）、`lib.rs:179-187`（`on_shortcut`→`toggle_panel`）、`lib.rs:146-162`（show+set_focus）、`lib.rs:165-175`（右上角锚定，乘 `scale_factor`）；焦点落点：`src/App.tsx:57-67`（仅在前端 `visible` 变化时 `searchRef.current?.focus()`） | 窗口显示与右上角锚定已实现。**搜索框聚焦不成立**：Rust 侧 `toggle_panel` 只 `emit("panel:toggle", …)`（`lib.rs:153,158`），而前端**全域无 `listen('panel:toggle')`**（`grep -rn "listen(" src/` 仅命中 `useGlobalShortcut.ts:25`）。故快捷键唤出时 `useUrlStore.visible` 不变、`App.tsx:57` 的 effect 不重跑、input 不获焦；`SearchBar.tsx:15-25` 也无 `autoFocus` |
| AC-02 | 再按 Alt+Space 或点击关闭 → 隐藏面板 | **部分实现** | 快捷键路径：`lib.rs:150-154`（`is_visible()` 为真则 `hide()`）；关闭按钮：`src/components/LauncherPanel.tsx:55-62` → `setVisible(false)`；Esc：`src/App.tsx:73-74` | 快捷键二次按下可隐藏（Rust 侧读真实窗口态）。**关闭按钮 / Esc 存在状态失同步缺陷**：`openItem` 已把 `visible` 置 false（`src/stores/useUrlStore.ts:155`），此后 Rust 侧 `show()` 使窗口可见但前端 `visible` 仍为 `false`；此时点关闭/按 Esc → `setVisible(false)` 无状态变化 → `App.tsx:57` effect 不触发 → 窗口不隐藏 |
| AC-03 | 启动即在托盘显示常驻图标，左键可切换面板 | **部分实现** | 构建：`src-tauri/src/tray.rs:16-55`（图标 `tray.rs:17-20`、菜单 `tray.rs:22-31`、左键 `tray.rs:47-51` → `crate::toggle_panel`）；装配：`lib.rs:67`；图标资源：`src-tauri/icons/{32x32.png,128x128.png,128x128@2x.png,icon.ico}` 齐备；`tauri.conf.json:35-39` 已声明 | 托盘逻辑完整。但**存在两处疑似编译阻断**（见 §5 B-01/B-02），未编译前无法确认可启动。另：托盘"设置"菜单 `tray.rs:42` 发 `emit("navigate","settings")`，**前端无对应 listener**，该菜单项点击后 UI 无响应 |
| AC-04 | 输入关键词 **50ms 内**实时过滤（标题/URL/分类） | **无法静态判定**（实现落点齐备） | 三字段匹配：`src-tauri/src/db/repositories/url_repo.rs:60-67`（`l.title` / `l.url` / `c.name` 三路 LIKE，LEFT JOIN categories）；通配符转义 `url_repo.rs:71-85`；防抖 `src/App.tsx:42` + `src/hooks/useDebouncedSearch.ts:14-21`（120ms）；触发重查 `src/stores/useUrlStore.ts:130-133` | 过滤语义正确且做了 `%`/`_`/`\` 转义（防 LIKE 语义注入）。50ms 预算须实测：当前为「120ms 防抖 → IPC → SQLite LIKE 全表扫（无 FTS/无前缀索引）→ 回传 ≤5000 行」，感知延迟必 >50ms，需运行时测 1000 条基线 |
| AC-05 | 点击/回车 → 用指定浏览器打开并隐藏面板 | **代码已实现（待运行验证）** | 打开：`src/stores/useUrlStore.ts:150-156`（读 `defaultBrowser`，非 `system` 时作为 `openWith` 传入）→ `src/services/tauri.ts:20-23` → `plugin-opener`；回车：`src/App.tsx:85-88` → `openSelected`；点击：`src/components/UrlRow.tsx:40-43`；隐藏：`useUrlStore.ts:155`；权限：`src-tauri/capabilities/default.json`（`opener:allow-open-url` 含 chrome/msedge/firefox/`app:true`） | 自定义 exe 路径经 `SettingsDialog.tsx:81-82` 归一为 `resolvedBrowser` 后同路传入 |
| AC-06 | 未设指定浏览器 → 用系统默认浏览器 | **代码已实现（待运行验证）** | `src/stores/useUrlStore.ts:151-152`：`browser && browser !== 'system' ? browser : undefined`；后端默认值为空串 `src-tauri/src/db/repositories/settings_repo.rs:37`（`unwrap_or_default()`），空串为 falsy 同样落到 `undefined` | 空串与 `'system'` 两种历史取值都能正确降级为系统默认，无空洞 |
| AC-07 | 仅填 URL 确认 → 创建条目并**后台**抓取标题/favicon | **部分实现** | 创建：`src-tauri/src/commands/urls.rs:28-59`；去重 `urls.rs:40-42`；后台抓取 `urls.rs:49-57`（`async_runtime::spawn`，不阻塞返回）；抓取实现 `src-tauri/src/commands/fetch.rs:16-46`；前端仅 URL 必填 `src/components/AddUrlDialog.tsx:8,41,45-48` | 「仅填 URL」主路径成立。**缺陷**：`urls.rs:51-56` 后台回填时无条件 `update_meta(title=meta.title)`，会把用户在 `AddUrlDialog` 手填的标题（`AddUrlDialog.tsx:53`）静默覆盖为抓取标题；抓取失败时更覆盖为裸 URL（`fetch.rs:41-44`）。用户输入被丢弃 = 数据完整性缺陷（B-05） |
| AC-08 | 抓取超时(>5s)/失败/离线 → 用默认图标与 URL 作标题，不崩溃 | **部分实现** | 标题降级：`fetch.rs:26`（`timeout(5s)`）、`fetch.rs:39-45`（任何 `Err` → `title = url`，`favicon_path = None`）、客户端级 5s 超时 `lib.rs:48-51`；favicon 下载全链路 `Option`（`fetch.rs:71-97`，`.ok()?` 不 panic）；并发限流 `fetch.rs:18-21` | 后端降级不崩溃、语义正确。**前端默认图标降级不可达**：`src/components/UrlRow.tsx:31` 初始 `fav='loading'`，`<img>` 仅在 `fav==='ok'` 时渲染（`UrlRow.tsx:47-57`），而**全组件无任何 `setFav('ok')`**（唯一 `setFav` 是 `UrlRow.tsx:55` 的 `onError`）。状态机死锁在 `loading`：`<img>` 永不挂载 → `onError` 永不触发 → monogram 分支 `UrlRow.tsx:58-62` 永不可达。每行永久显示旋转 loader（B-04） |
| AC-09 | 选择 Bookmarks.html 导入 → 解析并**按文件夹映射分类**批量入库且去重 | **部分实现** | 命令：`src-tauri/src/commands/bookmarks.rs:14-48`（文件夹→分类 `bookmarks.rs:32-38`、去重 `bookmarks.rs:40-43`、scheme 校验 `bookmarks.rs:28-31`）；分类查找/创建（大小写不敏感）`src-tauri/src/db/repositories/category_repo.rs:144-167`；解析器 `src-tauri/src/bookmarks/parse.rs:16-102`；UI `src/components/ImportDialog.tsx:29-52` | 命令层去重/映射/进度 UI 齐备。**解析器有阻断级缺陷**：`parse.rs:86-96` 在 `h3` 分支用 `dt.next_siblings()` 找文件夹内容 `<dl>`，但按 HTML5 树构造算法，`<dl>` 起始标签不闭合未闭合的 `<dt>`，该 `<dl>` 是 `<dt>` 的**子节点**而非后继同级节点（已用 parse5 实测复现，见 §1.1）。后果：**所有文件夹内的书签被静默丢弃**，仅根 `<DL>` 直属的顶层链接被导入，分类映射永不生效（B-03） |
| AC-10 | 将书签 .html 拖入窗口 → 触发导入流程 | **部分实现** | 通道 A（Rust 原生）：`lib.rs:93-108`（`WindowEvent::DragDrop` → `resolve_dropped` → `emit("drag:resolved")`）；前端实际接线走 `src/hooks/useDragDrop.ts:37-62`（`onDragDropEvent`，`pickHtml` 于 `useDragDrop.ts:16-18`）→ `src/App.tsx:46-49`（`setPendingImportPath` + 开 ImportDialog）→ `ImportDialog.tsx:24-27` 回填路径 | 拖入 .html 触发导入的链路完整。但导入终点是 AC-09 的同一个 `bookmarks_import`，**继承 B-03 缺陷**。另：`lib.rs:103` 的 `emit("drag:resolved")` 前端无 listener（孤儿事件）；通道 B（`useDragDrop.ts:70-99` HTML5 `text/uri-list`）在 Windows 上因 `dragDropEnabled` 默认为 true 而被 WebView2 屏蔽，属死代码（advisory）。纯链接拖拽按 spec 为 P2，不计入 MVP |
| AC-11 | 新建/改名/删除/拖拽排序分类 → 持久化且 UrlList 即时反映 | **未实现（前端无入口）** | 后端齐备：`src-tauri/src/commands/categories.rs:15-27`（create）、`:29-44`（update）、`:46-54`（delete，级联置 NULL）、`:56-62`（reorder）；仓储 `category_repo.rs:59-140`；契约齐备 `openapi.yaml:139,157,175,189`；已注册 `lib.rs:120-124`。**前端引用数为 0**：`grep -rc category_create\|category_update\|category_delete\|category_reorder src/` → 全部 0；`src/components/CategorySidebar.tsx:32-51` 仅有选择按钮，无新建/改名/删除/拖拽排序任何 UI 或 handler | P0 需求未满足：四个分类写命令在前端**完全没有调用方**，用户无法新建/改名/删除/排序分类。附带：`CategorySidebar.tsx:22` 用 `id === '__uncategorized__'` 取未分类计数，但 `categories_list`（`category_repo.rs:43-56`）只返回真实行、从不返回该伪分类 → 「未分类」计数恒为 0；`CategorySidebar.tsx:21` 的「全部」计数为各分类计数之和，漏算所有未分类链接 |
| AC-12 | 无数据 → 显示空状态引导（添加/导入入口），不白屏不报错 | **代码已实现（待运行验证）** | 空态渲染 `src/components/UrlList.tsx:62-68`；空态组件 `src/components/EmptyState.tsx:24-41`（含「添加第一个网址」`EmptyState.tsx:31-34` 与「导入书签」`EmptyState.tsx:35-38`）；无匹配态 `EmptyState.tsx:11-22`；后端未就绪时的白屏兜底 `src/stores/useUrlStore.ts:105-108`、`src/stores/useSettingsStore.ts:29-32` | 空态与无匹配态分离正确。轻微瑕疵（不违反 AC）：切到某个空分类且搜索框为空时会显示「还没有网址」总空态而非「该分类为空」 |
| AC-13 | 常驻 8 小时内存稳定且无自动退出 | **无法静态判定** | 可静态观察到的正向设计：favicon 抓取并发上限 4（`src-tauri/src/state.rs:24` + `fetch.rs:18-21`）、favicon 体积上限 2MB（`fetch.rs:90-92`）、列表虚拟滚动（`src/components/UrlList.tsx:49-54`）、单连接 `Arc<Mutex<Connection>>` 无连接泄漏（`state.rs:22`）、窗口/键盘监听均有 cleanup（`App.tsx:91`、`useDragDrop.ts:105-110`、`useGlobalShortcut.ts:32-35`） | 内存曲线与长稳只能运行时观测，须 8h 挂机 |
| AC-14 | 开启自启后系统重启 → 自动启动并常驻托盘 | **代码已实现（待运行验证）** | 插件装配 `lib.rs:35-38`；启动时按设置同步 `lib.rs:78-86`；`apply_autostart` `lib.rs:195-204`；命令 `src-tauri/src/commands/autostart.rs:10-39`（同时回写 settings 行）；`settings_set` 内同步 `src-tauri/src/commands/settings.rs:45`；权限 `capabilities/default.json`（enable/disable/is_enabled 三项）；UI 开关 `src/components/SettingsDialog.tsx:204-218` + `SettingsDialog.tsx:136` | 注册表 `HKCU\Run` 实写与重启后行为须运行时验。注意 `lib.rs:36` 传的是 `MacosLauncher::LaunchAgent`（Windows 下该参数被忽略，无实际影响） |
| AC-15 | 打开 URL 时仅允许 http/https，拒绝命令注入 | **代码已实现（待运行验证）** | 统一校验器 `src-tauri/src/error.rs:87-93`（`url::Url::parse` + scheme 白名单）；调用点：`commands/urls.rs:37`（url_create）、`commands/fetch.rs:50`（fetch_meta）、`commands/bookmarks.rs:28`（导入逐条）、`commands/data.rs:124`（JSON 导入逐条）；拖拽侧 `src-tauri/src/dragdrop.rs:69-71`（`is_safe_web`）；书签解析侧二次过滤 `bookmarks/parse.rs:73`；前端 `src/components/AddUrlDialog.tsx:8`（`^https?://`）。SQL 注入面：全部仓储均用 `rusqlite::named_params!` 绑定，`grep` 未见任何值拼接（`url_repo.rs` / `category_repo.rs` / `settings_repo.rs` 全文）；`url_repo.rs:60-67` 仅拼接静态片段，用户输入走 `:like`/`:search`/`:category_id`/`:limit` | scheme 白名单覆盖所有写入口，命令注入面（拼接 shell / 拼接 SQL）静态未见。防御纵深有一处松动：`capabilities/default.json` 的 `opener:allow-open-url` 首条 scope 为 `{"url": "**"}`，等于不限 scheme，仅靠应用层校验兜底（advisory A-04） |

**统计**：代码已实现（待运行验证）4 条（AC-05/06/12/14）；部分实现 8 条（AC-01/02/03/07/08/09/10/11 中除 AC-11 外）；未实现 1 条（AC-11）；无法静态判定 2 条（AC-04/13）。
---

## 3. 契约一致性核查

### 3.1 四方对齐：openapi operationId ↔ generate_handler! ↔ `#[tauri::command]` ↔ 前端 invoke

命令总数 **20**，四方结果如下（均为 grep 实测计数）：

| 项 | 数量 | 取数方式 |
|----|------|----------|
| `openapi.yaml` operationId | 20 | `grep -c operationId openapi.yaml` |
| `lib.rs` `generate_handler!` 注册项 | 20 | `lib.rs:112-139` 逐行 |
| `#[tauri::command]` 唯一函数名 | 20 | 全仓 grep 去重 |
| 前端 `invoke('…')` 唯一命令名 | 14 | `grep -rhoP "invoke<[^>]*>\('\K[a-z_]+" src/` |

逐条对照：

| # | 命令 | openapi | 已注册 | `#[tauri::command]` 落点 | 前端调用点 |
|---|------|:---:|:---:|---|---|
| 1 | `urls_list` | `openapi.yaml:30` | `lib.rs:114` | `commands/urls.rs:12` | `src/services/urls.ts:11` |
| 2 | `url_create` | `:50` | `lib.rs:115` | `commands/urls.rs:28` | `services/urls.ts:14` |
| 3 | `url_update` | `:68` | `lib.rs:116` | `commands/urls.rs:62` | `services/urls.ts:17` |
| 4 | `url_delete` | `:86` | `lib.rs:117` | `commands/urls.rs:77` | `services/urls.ts:20` |
| 5 | `url_refresh_meta` | `:100` | `lib.rs:118` | `commands/urls.rs:89` | `services/urls.ts:23` |
| 6 | `categories_list` | `:118` | `lib.rs:120` | `commands/categories.rs:11` | `stores/useUrlStore.ts:104` |
| 7 | `category_create` | `:139` | `lib.rs:121` | `commands/categories.rs:16` | **无（孤儿）** |
| 8 | `category_update` | `:157` | `lib.rs:122` | `commands/categories.rs:30` | **无（孤儿）** |
| 9 | `category_delete` | `:175` | `lib.rs:123` | `commands/categories.rs:47` | **无（孤儿）** |
| 10 | `category_reorder` | `:189` | `lib.rs:124` | `commands/categories.rs:57` | **无（孤儿）** |
| 11 | `bookmarks_import` | `:203` | `lib.rs:126` | `commands/bookmarks.rs:15` | `services/bookmarks.ts:7` |
| 12 | `import_json` | `:221` | `lib.rs:127` | `commands/data.rs:97` | `services/settings.ts:26` |
| 13 | `fetch_meta` | `:239` | `lib.rs:128` | `commands/fetch.rs:49` | **无（孤儿）** |
| 14 | `settings_get` | `:257` | `lib.rs:130` | `commands/settings.rs:14` | `services/settings.ts:6` |
| 15 | `settings_set` | `:276` | `lib.rs:131` | `commands/settings.rs:19` | `services/settings.ts:9` |
| 16 | `autostart_enable` | `:290` | `lib.rs:133` | `commands/autostart.rs:11` | `services/settings.ts:12` |
| 17 | `autostart_disable` | `:305` | `lib.rs:134` | `commands/autostart.rs:23` | `services/settings.ts:15` |
| 18 | `autostart_is_enabled` | `:320` | `lib.rs:135` | `commands/autostart.rs:35` | `services/settings.ts:18` |
| 19 | `panel_toggle` | `:339` | `lib.rs:137` | `lib.rs:208` | **无（openapi 已注明前端通常不 invoke，符合预期）** |
| 20 | `drag_resolve` | `:354` | `lib.rs:138` | `lib.rs:214` **和** `commands/drag.rs:11`（重复定义） | `services/bookmarks.ts:14` |

**孤儿清单**

- 后端有 + 已注册 + openapi 有，但**前端零调用**：`category_create` / `category_update` / `category_delete` / `category_reorder` / `fetch_meta` / `panel_toggle`（6 个）。
  - 其中 4 个分类写命令的缺失即 **AC-11 未实现**（阻断，B-06）。
  - `fetch_meta` 由 `url_create` / `url_refresh_meta` 内部复用（`commands/urls.rs:50`、`urls.rs:100` 调 `fetch::fetch_url_meta`），前端不直调属合理设计，非缺陷。
  - `panel_toggle` openapi 已声明"由 Rust 侧触发"，非缺陷。
- 前端调用了但后端没有：**0 个**。
- 后端有但未注册：**0 个**（`commands/drag.rs:11` 的 `drag_resolve` 与 `lib.rs:214` 同名重复实现，注册的是 `lib.rs` 版本；`commands/drag.rs` 整个文件为死代码，advisory A-01）。
- openapi 缺失：**0 个**。

### 3.2 字段命名核查（Rust serde camelCase ↔ TS 接口）

所有 6 个模型均带 `#[serde(rename_all = "camelCase")]`（`src-tauri/src/models.rs:10,22,34,42,49,57`）。

| 模型 | Rust 字段（`models.rs`） | 序列化后 JSON 键 | TS 接口（`src/types/models.ts`） | openapi | 结论 |
|------|--------------------------|------------------|-----------------------------------|---------|------|
| **Url** | `id` `title` `url` `category_id` `note` `favicon_path` `created_at`（`:12-18`） | `id title url categoryId note faviconPath createdAt` | `:6-14` 同名同序 | `openapi.yaml:384-408` 同名 | 对齐 |
| **Category** | `id` `name` `sort` `color` `icon` `created_at` `count`（`:24-30`） | `id name sort color icon createdAt count` | `:17-25` 同名 | `openapi.yaml:415-438` 同名 | 对齐（`count` 有可空性差异，见下） |
| **Settings** | `hotkey` `default_browser` `autostart`（`:36-38`） | `hotkey defaultBrowser autostart` | `:35-39` 同名 | `openapi.yaml:446-457` 同名 | 对齐（`defaultBrowser` 有 enum 差异，见下） |
| **ImportResult** | `imported` `skipped`（`:44-45`） | `imported skipped` | `:41-44` 同名 | `openapi.yaml:463-469` | 对齐 |
| **UrlMeta** | `title` `favicon_path`（`:51-52`） | `title faviconPath` | `:46-49` 同名 | `openapi.yaml:475-482` | 对齐 |
| **UrlDraft** | `url` `title` `category_id`（`:59-61`） | `url title categoryId` | `:52-56` 同名 | `openapi.yaml:490-502` | 对齐 |

命令**入参**方向（Tauri 自动 camelCase→snake_case）：
- `urls_list(category_id, search, limit)`（`commands/urls.rs:14-16`）↔ 前端 `UrlsListArgs {categoryId, search, limit}`（`types/models.ts:60-64`）— 对齐。
- `settings_set(hotkey, default_browser, autostart)`（`commands/settings.rs:21-24`）↔ 前端整对象打平传入 `invoke('settings_set', settings)`（`services/settings.ts:9`），键 `defaultBrowser` → `default_browser` — 对齐（后端为打平三参而非 `Settings` 结构体入参，与 openapi 的 `$ref: Settings` 在 JSON 形状上等价）。
- `category_reorder(ordered_ids)`（`commands/categories.rs:59`）↔ `CategoryReorderArgs {orderedIds}`（`types/models.ts:94-96`）— 对齐（无调用方）。
- `import_json(path)`（`commands/data.rs:99`）↔ `services/settings.ts:26` — 对齐。
- `drag_resolve(items)`（`lib.rs:214`）↔ `services/bookmarks.ts:14` — 对齐。

发现的两处**契约描述偏差**（不影响运行，属文档与实现不一致）：

| # | 位置 | 偏差 |
|---|------|------|
| D-1 | `openapi.yaml:453` | `Settings.defaultBrowser` 声明 `enum: [chrome, msedge, firefox]`，但实现中合法取值还包括 `'system'`（`types/models.ts:33`、`stores/useUrlStore.ts:152`）与任意自定义 exe 绝对路径（`SettingsDialog.tsx:82`），且后端 `commands/settings.rs:19-24` 不做枚举校验、默认值为空串（`settings_repo.rs:37`）。契约的 enum 应删除或补全 |
| D-2 | `openapi.yaml:436-438` / `models.rs:30` | Rust 为 `count: Option<i64>` → 可序列化为 `null`；TS 声明为 `count: number`（非空，`types/models.ts:24`）。当前 `category_repo.rs:23` 恒填 `Some(...)`，运行时不会出现 null，但类型契约偏松 |

### 3.3 数据库契约（`0001_init.sql` ↔ spec 第 6 节 ↔ 仓储 SQL）

| 表 | spec 第 6 节要求 | `0001_init.sql` | 仓储读写 | 结论 |
|----|------------------|-----------------|----------|------|
| `categories` | `id TEXT PK, name TEXT NOT NULL, sort INT DEFAULT 0, color, icon, created_at` | `:8-15` 逐字段一致 | `category_repo.rs:30,45,72,104,127,158` | 对齐 |
| `links` | `id TEXT PK, title, url TEXT NOT NULL, category_id NULL, note, favicon_path NULL, created_at` | `:18-26` 逐字段一致 | `url_repo.rs:39,61,116,147,170,182` | 对齐 |
| `settings` | `key TEXT PK, value TEXT` | `:29-32` 一致 | `settings_repo.rs:14,27` | 对齐 |
| 索引 | `idx_categories_sort` / `idx_links_category` / `idx_links_url` | `:35-37` 三个齐备 | — | 对齐 |
| WAL | spec §11 防半写损坏 | 在连接层设置 `db/connection.rs:18` | — | 对齐（落盘行为待运行时验） |

一处实现与注释不符（不阻断）：`0001_init.sql:24` 注释称 `favicon_path` 形如 `favicons/{sha1(url)}.png`（相对路径），实际 `commands/fetch.rs:94-96` 写入的是**绝对路径**，`url_repo.rs:3-4` 与 `commands/urls.rs:83`（按该路径 `remove_file`）也按绝对路径处理。行为自洽，仅 SQL 注释过时。

---

## 4. P0 红线终检

扫描范围：`src/**/*.{ts,tsx,css}` 与 `src-tauri/src/**/*.rs`。

| 红线 | 命中数 | 判定 | 证据 |
|------|:---:|------|------|
| **emoji 作为功能图标** | **0** | 通过 | `grep -rlP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{26FF}\x{2700}-\x{27BF}\x{FE0F}]' src/ src-tauri/src/` → 命中文件数 0。放宽到含箭头区（U+2190–U+21FF）后有 14 处命中，**全部是代码注释里的中文排版箭头 `→`**（如 `src/components/Icon.tsx:48`、`src-tauri/src/dragdrop.rs:5`），无一处出现在 JSX/渲染路径。所有 UI 图标统一走 `src/components/Icon.tsx`（`Icon.tsx:5-25` 从 `lucide-react` 白名单导入 19 个图标，`Icon.tsx:49-69` 映射表，`Icon.tsx:81-85` 唯一出口） |
| **紫→粉渐变 / 发光边框 / 毛玻璃** | **0** | 通过 | `grep -rniE 'purple\|pink\|fuchsia\|violet\|magenta\|A855F7\|EC4899\|D946EF\|8B5CF6\|7C3AED\|backdrop-filter\|linear-gradient\|radial-gradient' src/` → 零输出。主色为墨蓝 `--accent: #3B5BDB`（`src/lib/design-tokens.css:13`），与 spec 第 8 节锁定值一致 |
| **组件类规则内裸 hex** | **0** | 通过 | 全仓 `src/**/*.{css,ts,tsx}` 共 16 处 hex，**全部落在 `src/lib/design-tokens.css` 的 `:root` Token 定义块内（第 4–79 行，实际占用 6–23 行）**：`#F3F4F6 #FFFFFF #F5F6F8 #1B1D23 #3C3F47 #6B7280 #9AA0A8 #3B5BDB #FFFFFF #E6E8EC #F0F1F4 #2F4BC4 #283FA8 #1F9D55 #C2810B #E5484D`。用 awk 排除 `:root` 块后再扫描组件类规则 → 零命中。`.tsx` 文件中零 hex、零内联颜色 |
| **占位文案（Lorem ipsum / Welcome to 等）** | **0** | 通过 | `grep -rniE 'lorem ipsum\|welcome to\|sign up today\|placeholder text\|coming soon' src/` → 零输出。所有文案为具体业务语（如 `EmptyState.tsx:28-29`「还没有网址 / 添加一个网址，或导入浏览器书签开始整理。」） |
| 动效降级 | — | 通过 | `src/lib/design-tokens.css:599-600` 有 `@media (prefers-reduced-motion: reduce)` 块，符合 spec 第 8 节 |

**P0 红线结论：4 项全部通过，零命中，无需返工。**
---

## 5. 阻断缺陷清单（RoleVerdict）

```yaml
verdict: fail
# 三条类型约束：correctness（正确性）/ unmet_requirement（需求未满足）/ contract_security_data（契约/安全/数据完整性）
blocking:
  # —— correctness：疑似 Rust 编译阻断（本机未编译，基于命名解析静态判定）——
  - id: B-01
    type: correctness
    title: "build_tray 未导入即调用，编译必失败"
    evidence: "src-tauri/src/lib.rs:67（`build_tray(&app_handle)`）；lib.rs:1 头 `use tauri::{AppHandle, Emitter, Manager}`（无 `use crate::tray::build_tray;`）；定义位于 src-tauri/src/tray.rs:16（`pub fn build_tray`）"
    expect: "在 lib.rs 增加 `use crate::tray::build_tray;`，或将调用改为 `crate::tray::build_tray(&app_handle)`。否则 `cargo build` 报 E0425 unresolved name"
    affects: "AC-03（托盘启动）"
  - id: B-02
    type: correctness
    title: "ShortcutState 未导入即匹配，编译必失败"
    evidence: "src-tauri/src/lib.rs:182（`match state { ShortcutState::Pressed => ..., _ => {} }`）；lib.rs 头导入无 `ShortcutState`；该类型来自 `tauri_plugin_global_shortcut`（见 commands/autostart.rs 等其余文件正确用法）"
    expect: "增加 `use tauri_plugin_global_shortcut::ShortcutState;`。否则 `cargo build` 报 E0412 unresolved import/type"
    affects: "AC-01/AC-02（快捷键唤出/隐藏）"

  # —— correctness：确定性运行缺陷（已静态定位）——
  - id: B-03
    type: correctness
    title: "书签解析器按「后继同级」找文件夹内容，按 HTML5 树构造应为「子节点」，致文件夹内书签全丢"
    evidence: "src-tauri/src/bookmarks/parse.rs:86-96（`h3` 分支 `dt.next_siblings()` 找 `<dl>`）；parse5 探针（docs/qa/_probe_bookmark_tree.mjs）实测：文件夹 `<dl>` 是 `<dt>` 子节点=true，后继同级=false → 搜索命中 0"
    expect: "改为遍历 `dt` 的元素子节点取 `<dl>`（或改用 parser 提供的父/子 API），并保留当前文件夹上下文下钻递归。修复后须用含二级嵌套文件夹的 Bookmarks.html 复验"
    affects: "AC-09（按文件夹映射分类）、AC-10（拖入导入继承此缺陷）"

  - id: B-04
    type: correctness
    title: "UrlRow favicon 状态机死锁：永不置 'ok'，旋转 loader 永久存在，默认图标/字母块分支不可达"
    evidence: "src/components/UrlRow.tsx:31（`useState<FavState>('loading')`）；:47-57（`<img>` 仅在 `fav==='ok'` 渲染）；全组件仅 `setFav('error')` 于 :55，`setFav('ok')` 出现 0 次（grep 实测）；:58-62 monogram 分支因 `<img>` 永不挂载而不可达"
    expect: "在 favicon 加载成功回调（或初始已缓存路径时）置 `setFav('ok')`；或在无 favicon 时显式置 `'error'` 走 monogram。无论哪条路径都需让 `loading` 终态可达"
    affects: "AC-08（降级图标）、AC-12 观感"

  # —— contract_security_data：数据完整性 ——
  - id: B-05
    type: contract_security_data
    title: "url_create 后台抓取无条件覆盖用户在表单手填的标题"
    evidence: "src-tauri/src/commands/urls.rs:51-56（`update_meta(title = meta.title)` 无条件执行）；抓取失败时 `fetch.rs:39-45` 将 `title` 降级为裸 URL；用户手填标题入口 `src/components/AddUrlDialog.tsx:53`"
    expect: "仅当用户创建时未提供 title（即 `title` 为空）才用抓取结果回填；用户显式填了 title 则保留。避免静默丢弃用户输入"
    affects: "AC-07（后台抓取标题）数据完整性"

  # —— unmet_requirement：P0 需求未实现 ——
  - id: B-06
    type: unmet_requirement
    title: "AC-11 分类写操作（新建/改名/删除/排序）后端齐备但前端零调用，用户无法操作分类"
    evidence: "后端 `src-tauri/src/commands/categories.rs:16/30/47/57`（create/update/delete/reorder）四命令均已注册（lib.rs:121-124）；`grep -rc category_create\|category_update\|category_delete\|category_reorder src/` 全部 0；`src/components/CategorySidebar.tsx:32-51` 仅有选择按钮"
    expect: "在 CategorySidebar / 某入口补齐四个命令的调用与对应 UI（右键菜单或设置面板 + 拖拽排序 handler）。AC-11 为 P0 验收项，缺失即不达交付门槛"
    affects: "AC-11（分类持久化与即时反映）"

advisory:
  - id: A-01
    type: correctness
    title: "commands/drag.rs 整文件为死代码"
    evidence: "src-tauri/src/commands/drag.rs:11（`drag_resolve` 与 lib.rs:214 同名重复定义）；注册的是 lib.rs 版本；前端 `services/bookmarks.ts:14` 调的是 lib.rs 版本；commands/drag.rs 无任何调用方"
    recommend: "删除整个文件，避免后续维护误改到未被注册的实现"
  - id: A-04
    type: contract_security_data
    title: "opener 能力 scope 首条为 {\"url\":\"**\"}，等于不限 scheme"
    evidence: "src-tauri/capabilities/default.json（`opener:allow-open-url` 首条 scope `{"url":"**"}`）"
    recommend: "收紧为 `{\"url\":\"http://*\"}` / `{\"url\":\"https://*\"}`（运行时打开仍受 error.rs:87-93 scheme 白名单兜底，但能力层应最小授权）。注意 AC-15 的 scheme 校验仍是主防线"
```

### 5.1 非阻断但需跟进的偏差（不计入 blocking，登记于 AC 表中）

| 编号 | 类型 | 落点 | 说明 |
|------|------|------|------|
| A-02 | correctness | `src/App.tsx:57-67` 与全域无 `listen('panel:toggle')` | 快捷键唤出时搜索框不获焦（AC-01 聚焦落点缺失）；与 B-02 修复后需一并补 listener 或改用 Rust `set_focus` 直接聚焦 |
| A-03 | correctness | `src/App.tsx:73-74`、`LauncherPanel.tsx:55-62`、`useUrlStore.ts:155` | 关闭按钮/Esc 与 Rust 窗口态存在失同步（AC-02）；`openItem` 已置 `visible=false`，后续 Rust `show()` 后点关闭无状态变化 → 不隐藏 |
| A-05 | correctness | `src-tauri/src/tray.rs:42`（`emit("navigate","settings")`） | 前端无对应 listener，托盘"设置"菜单点击无响应 |
| A-06 | correctness | `src/components/CategorySidebar.tsx:21-22` | `__uncategorized__` 伪分类后端永不返回 → 未分类计数恒 0；"全部"计数漏算未分类链接 |
| D-1 | contract | `openapi.yaml:453` | `Settings.defaultBrowser` enum 与实际取值（含 `'system'`、自定义 exe 路径）不符，契约应更新 |
| D-2 | contract | `openapi.yaml:436-438` / `models.ts:24` | `count` Rust 为 `Option<i64>`，TS 声明为非空 `number`，类型契约偏松 |

---

## 6. 待运行时验证清单（手工步骤）

> 下列项无法静态判定，须在编译通过 + 应用启动后由人工/脚本实测。每项标注对应 AC 与关联缺陷。

| # | 验证项 | 对应 AC | 手工步骤 |
|---|--------|---------|----------|
| R-1 | Rust 侧能否编译 | B-01/B-02 | 安装 cargo 后执行 `cd src-tauri && cargo build`。预期：先报 B-01/B-02 两处 E0425/E0412，修复后通过。**本机当前未执行** |
| R-2 | Alt+Space 唤出 + 搜索框聚焦 | AC-01 | 启动后按 Alt+Space，观察面板是否出现于右上角且搜索框已获焦。注：若系统/输入法已占用 Alt+Space（A-02），需改键或确认无抢占 |
| R-3 | 二次 Alt+Space / 关闭 / Esc 隐藏 | AC-02 | 唤出后再次按快捷键隐藏；点击关闭按钮、按 Esc 各测一次，确认窗口消失（留意 A-03 失同步） |
| R-4 | 高 DPI 锚定精度 | AC-01 | 在 125%/150% 缩放屏下唤出，量取面板右上角与屏幕物理边距是否仍贴边（`lib.rs:165-175` 乘 `scale_factor` 是否正确） |
| R-5 | 托盘图标 + 左键切换 | AC-03 | 启动后看托盘是否有图标；左键点击应切换面板显隐；点"设置"菜单项（A-05）观察是否无响应 |
| R-6 | 拖入 Bookmarks.html | AC-10 | 从资源管理器拖一个 `.html` 进窗口（Windows 注意 WebView2 对 `text/uri-list` 通道 B 的屏蔽，走 Rust 原生通道 A）；确认弹出导入对话框并带路径 |
| R-7 | 书签导入按文件夹映射（B-03 复验） | AC-09 | 准备含**两级嵌套文件夹**的 Chrome 导出的 Bookmarks.html，导入后查分类数量与链接归属。预期：各文件夹成为分类且链接正确归入；修复 B-03 前应观察到"仅顶层链接入库、文件夹内全丢" |
| R-8 | 仅填 URL 创建 + 手填标题保留 | AC-07/B-05 | 新建时仅填 URL、并显式填一个自定义标题；确认列表中标题为你填的文案，而非抓取标题/裸 URL |
| R-9 | favicon 降级观感（B-04 复验） | AC-08 | 导入若干无 favicon 的 URL，观察每行是否最终显示字母块/默认图标，而非永久旋转 loader |
| R-10 | 系统默认浏览器降级 | AC-06 | 设置项保持"系统默认"，点击链接确认用系统默认浏览器打开 |
| R-11 | 搜索延迟基线 | AC-04 | 预置 1000 条数据，输入关键词测首屏渲染与过滤感知延迟，对比 50ms 预算（当前 120ms 防抖 + 全表 LIKE，预期超预算） |
| R-12 | 自启注册表实测 | AC-14 | 开启自启后查 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` 是否有条目；重启系统验证自动启动与托盘常驻 |
| R-13 | 打开 URL scheme 拦截 | AC-15 | 尝试导入/打开 `file://`、`javascript:` 等非 http/https 链接，确认被拒绝且前端正则与后端 `ensure_safe_url` 双拦截 |
| R-14 | 8 小时内存稳定 | AC-13 | 挂机 8h，用任务管理器记录 Rust 进程常驻内存在不同时点是否平稳、无持续增长；期间多次导入/打开/搜索 |
| R-15 | WAL 落盘与崩溃恢复 | spec §11 | 导入过程中强杀进程，重启后确认数据未半写损坏（WAL 在 `db/connection.rs:18` 已开，落盘行为待验） |
| R-16 | opener scope 收紧验证（A-04） | AC-15 | 收紧 `{"url":"**"}` 为 `http/https` 后，确认 chrome/msedge/firefox 三类与自定义 exe 仍可正常打开 |

---

## 7. 汇总

| 维度 | 结论 |
|------|------|
| 报告性质 | **静态代码核对**，非运行时测试；Rust 未编译 |
| 前端类型检查 | `npx tsc --noEmit` EXIT=0（零类型错误） |
| AC 总览 | 代码已实现（待运行验证）4 / 部分实现 8 / 未实现 1 / 无法静态判定 2 |
| 契约一致性 | 20 命令四方对齐，字段命名全部对齐；孤儿 6（其中 4 个分类写命令即 B-06）；文档偏差 D-1/D-2 |
| P0 红线 | emoji 0 / 紫粉渐变·发光·毛玻璃 0 / 裸 hex 0（全部位于 `:root`）/ 占位文案 0 —— **全部通过** |
| 阻断缺陷 | **6 条**（B-01~B-06） |
| 建议项 | A-01~A-06、D-1/D-2 |
| **最终 verdict** | **fail —— 须先修复 B-01/B-02 使之可编译，再修 B-03/B-04/B-05/B-06 并跑完 §6 运行时清单，方可进入交付评估** |
