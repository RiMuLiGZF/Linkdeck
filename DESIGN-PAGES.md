# DESIGN-PAGES.md — url-launcher 组件级实现规约

> 阶段：Phase 2 设计细化（组件级，交前端直接落地）
> 配套文件：`DESIGN.md`（设计基调）、`tokens.css`（Token 源）、`design-tokens.json`（机器可读）
> 形态：Windows 桌面 · 系统托盘常驻 + 全局快捷键唤出 · 右上角浮窗
> 寄存器：Product Register（克制单色 + 表面层级替代阴影 + 真实内容优先）
> 所有颜色必须经 Token 引用（唯一例外：`#fff`/`#000` 仅用于 `--accent-on` 等语义固定处）

---

## 0. 全局实现规则（前端必须遵守）

### 0.1 Token 引用
- 颜色一律 `var(--xxx)`，禁止裸 hex（除 `#fff` 作 `--accent-on`）。
- 字号 / 间距 / 圆角 / 动效一律引用对应 Token。
- 强调色 tint 统一用 `color-mix(in srgb, var(--accent) N%, transparent)`。

### 0.2 图标规范（Lucide，禁 emoji）
- 库：`lucide-react`（React 栈，Spec 锁定 1.24.0）。
- 三档尺寸严格对齐：**16px**（行内 / 侧栏项）、**20px**（按钮内 / 搜索框）、**24px**（独立图标）。
- stroke：2；`color` 继承 `currentColor`（由文本色或 `--accent` 决定）。
- 本规约中所有图标名均为 Lucide 组件名（见各组件清单）。

### 0.3 字体与 OpenType
- 字体栈：`--font-body`（Inter + Noto Sans SC）、`--font-mono`（JetBrains Mono + Geist Mono）用于 URL / 计数 / 快捷键。
- 字重三档：Read 400 / Emphasize 510 / Announce 590。
- 开启 Inter 特性：`font-feature-settings: "cv05", "ss03";`
- 字距：正文 `0`；小字(≤12px) `0.01em`；ALL CAPS / 快捷键 `0.06em`（`--tracking-caps`）；标题(≥24px) `-0.01em`（`--tracking-display`）。

### 0.4 动效
- 时长：`--motion-fast`(150ms) 即时反馈 / `--motion-base`(200ms) 状态确认。
- 缓动：`--ease-standard`(cubic-bezier(0.2,0,0,1))。
- 必须支持 `@media (prefers-reduced-motion: reduce)`：关闭位移 / 旋转动画，保留透明度变化。

### 0.5 无障碍（a11y）
- 列表：`role="listbox"`（UrlList）+ `role="option"`（UrlRow）+ `aria-selected`。
- 搜索框 / 图标按钮必须有 `aria-label`（无文字标签时）。
- 所有可交互元素 `:focus-visible` 显示 `--focus-ring`。
- 错误输入：`aria-invalid="true"` + `aria-describedby` 关联错误文案 id。

### 0.6 P0 红线（零容忍，违反即退回）
- 禁 emoji 作功能图标（一律 Lucide，尺寸 16 / 20 / 24）。
- 禁紫→粉渐变主视觉。
- 禁硬编码颜色（全部 Token，唯一例外 `#fff` 作 accent-on）。
- 禁占位文案（"Welcome to" / "Lorem"）。
- 禁营销 Hero 大图（工具界面展示真实内容）。

---

## 1. LauncherPanel（右上角浮窗）

### 1.1 容器 Container
| 属性 | Token / 值 |
|------|-----------|
| width | `var(--panel-w)` = 520px |
| height | `min(720px, 88vh)`（即 `min(720px, var(--panel-max-h))`） |
| background | `var(--surface)` |
| border-radius | `var(--panel-radius)` = 16px |
| border | `1px solid var(--border)` |
| box-shadow | `var(--elev-raised)` |
| position | `fixed`；`top: var(--anchor-top)`(16px)；`right: var(--anchor-right)`(16px) |
| layout | `display:flex; flex-direction:column; overflow:hidden` |
| font-family | `var(--font-body)` |
| z-index | 高于应用内其他层（置顶浮窗） |

> 多显示器：最后所在屏由 Rust 侧记忆；本规约仅定义视觉与内部布局。

### 1.2 Header（搜索栏 + 图标按钮）
包层：
- `display:flex; align-items:center; gap: var(--space-2)`(8px)
- `padding: var(--space-3)`(12px) `var(--space-4)`(16px)
- `border-bottom: 1px solid var(--border-soft)`

SearchBar（flex:1）：
- 容器：`background: var(--surface-warm)`；`border-radius: var(--radius-md)`(12px)；`border: 1px solid var(--border-soft)`；`height: 40px`；`display:flex; align-items:center`；`padding: 0 var(--space-3)`(12px)
- 左图标：Lucide `search`，**20px**，`color: var(--meta)`，`margin-right: var(--space-2)`(8px)
- 输入框：flex:1；`font: var(--font-body)`；`font-size: var(--text-base)`(14px)；`color: var(--fg)`；`background: transparent`；`border:none`；`outline:none`
- 占位符：`搜索网址或分类…`；`color: var(--meta)`
- **Focus 态**：容器 `background: var(--surface)`；`border-color: var(--accent)`；`box-shadow: var(--focus-ring)`
- `aria-label="搜索网址或分类"`

图标按钮组（右侧）：`gear`（设置）、`x`（关闭），各 **20px**
- 按钮热区：`width/height: 32px`；`border-radius: var(--radius-sm)`(8px)；`background: transparent`；`display:flex; align-items:center; justify-content:center`
- 图标 `color: var(--muted)`
- hover：`background: var(--surface-warm)`；`color: var(--fg-2)`
- `:focus-visible`：`box-shadow: var(--focus-ring)`
- 各自 `aria-label="设置"` / `aria-label="关闭"`

### 1.3 CategorySidebar（左侧 168px）
包层：
- `width: var(--sidebar-w)`(168px)；`flex-shrink:0`
- `background: var(--surface-warm)`
- `border-right: 1px solid var(--border-soft)`
- `display:flex; flex-direction:column; gap: var(--space-1)`(4px)
- `padding: var(--space-2)`(8px)
- `overflow-y: auto`

条目 CategoryItem（首项 `全部` + 用户分类 + `未分类`）：
- `display:flex; align-items:center; gap: var(--space-2)`(8px)
- `height: 32px`；`padding: 0 var(--space-2)`(8px)
- `border-radius: var(--radius-sm)`(8px)
- 图标：Lucide `folder`（用户分类可用各自 `icon` 字段），**16px**，`color: var(--muted)`
- 名称：`flex:1`；`font-size: var(--text-sm)`(13px)；`font-weight: 510`；`color: var(--fg-2)`；`white-space:nowrap; overflow:hidden; text-overflow:ellipsis`
- 计数：`font-family: var(--font-mono)`；`font-size: var(--text-xs)`(12px)；`color: var(--meta)`；`text-align:right`
- **Hover 态**：`background: var(--surface)`（侧栏为 warm，hover 抬白以可见；见 §1.3 注）
- **Selected 态**：`background: color-mix(in srgb, var(--accent) 8%, transparent)`；名称与图标 `color: var(--accent)`
- **禁止** >1px 彩色左 / 右边条；选中仅以背景 tint + 文字色表达
- `:focus-visible`：`box-shadow: var(--focus-ring)`
- `role="button"` + `aria-pressed` 表示选中

> 注：DESIGN.md 将侧栏底色定为 `surface-warm`，故条目 hover 改用 `surface`（白）浮起以保可见性；选中仍用 accent 8% tint。若强行令 hover=surface-warm，则条目 hover 与底色同色不可见，故此处取可见解。

### 1.4 UrlList + UrlRow（右侧主区）
UrlList 包层：
- `flex:1`；`overflow-y:auto`
- `padding: var(--space-2)`(8px) `var(--space-3)`(12px)
- `display:flex; flex-direction:column`
- `role="listbox"`；`aria-label="网址列表"`
- 超长（>200 条）启用虚拟滚动（`@tanstack/react-virtual`）

UrlRow（每行）：
- `min-height: var(--row-min-h)`(44px)
- `display:flex; align-items:center; gap: var(--space-3)`(12px)
- `padding: 0 var(--space-2)`(8px)
- `border-radius: var(--radius-sm)`(8px)
- `role="option"`；`aria-selected`

子元素（左 → 右）：
1. **Favicon**（20×20）
   - `border-radius: 4px`；`flex-shrink:0`
   - 在线：`<img>` 加载 favicon（本地缓存或 `google/s2/favicons?domain=&sz=32`）
   - **离线 / 失败降级**：monogram —— 20×20 圆角方块，`background: color-mix(in srgb, var(--accent) 14%, transparent)`，`color: var(--accent)`，`font-family: var(--font-mono)`，`font-size: 11px`，`font-weight: 590`，居中显示域名首字母（大写）。备选：Lucide `globe` 16px `color: var(--meta)`
   - **Loading 态**：Lucide `loader` 20px，`color: var(--meta)`，CSS `animation: spin var(--motion-fast) linear infinite`
2. **主信息列**（flex:1；`min-width:0` 以便截断）
   - 名称：`font-size: var(--text-sm)`(13px)；`font-weight: 510`；`color: var(--fg)`；`white-space:nowrap; overflow:hidden; text-overflow:ellipsis`
   - URL：`font-family: var(--font-mono)`；`font-size: 11px`；`color: var(--meta)`；`white-space:nowrap; overflow:hidden; text-overflow:ellipsis`（低于 `--text-xs`，专为密集列表优化；非颜色无需 Token）
3. **分类 Pill**
   - `background: var(--surface-warm)`；`color: var(--muted)`
   - `border-radius: var(--radius-pill)`(9999px)；`padding: var(--space-1)`(4px) `var(--space-2)`(8px)
   - `font-size: var(--text-xs)`(12px)；`font-weight: 400`
4. **悬浮操作组**（默认隐藏，hover / focus-within 显现）
   - `display:flex; gap: var(--space-1)`(4px)
   - `opacity:0`；`transition: opacity var(--motion-fast) var(--ease-standard)`
   - `.url-row:hover &, .url-row:focus-within & { opacity:1 }`
   - 动作按钮（各 **16px** Lucide 图标）：`external-link`(打开) / `pencil`(编辑) / `copy`(复制) / `trash`(删除)
   - 按钮热区 24×24，`border-radius: var(--radius-sm)`，透明底，`color: var(--muted)`
   - hover：`background: var(--surface-warm)`；`color: var(--fg-2)`
   - `trash` hover：`color: var(--danger)`
   - 各 `aria-label`

### 1.5 FooterAddBar（底部添加条）
包层：
- `border-top: 1px solid var(--border-soft)`
- `padding: var(--space-3)`(12px) `var(--space-4)`(16px)
- `display:flex; align-items:center; gap: var(--space-2)`(8px)

主操作「添加网址」：
- Lucide `plus` **20px** + 文字，Primary Button
- `background: var(--accent)`；`color: var(--accent-on)`(=#fff)；`border-radius: var(--radius-sm)`(8px)
- `padding: var(--space-2)`(8px) `var(--space-4)`(16px)；`height: 36px`；`font-weight: 590`
- hover：`background: var(--accent-hover)`；active：`background: var(--accent-active)`
- `:focus-visible`：`box-shadow: var(--focus-ring)`

次操作「导入」：
- Lucide `upload` **20px** + 文字，Secondary Button
- `background: transparent`；`border: 1px solid var(--border)`；`color: var(--fg-2)`
- hover：`background: var(--surface-warm)`
- 点击触发 ImportDialog

拖拽提示：
- 文字「将链接拖入此处」，`color: var(--meta)`，`font-size: var(--text-xs)`(12px)，`margin-left:auto`

### 1.6 拖入态（Drag-over）
当从浏览器拖链接 / 书签文件入面板：
- 面板容器叠加 `box-shadow: var(--elev-raised), 0 0 0 2px var(--accent)`
- 绝对定位遮罩层覆盖面板：`background: color-mix(in srgb, var(--accent) 10%, transparent)`；`border: 2px dashed var(--accent)`；`border-radius: var(--panel-radius)`
- 居中文字「松开以添加网址」，`color: var(--accent)`，`font-weight: 510`
- `pointer-events:none`（拖放由窗口级 drag-drop 处理）

### 1.7 组件状态矩阵（UrlRow / CategoryItem / SearchBar）
| 状态 | 表现（Token 取值） |
|------|-------------------|
| Default | 行透明底；名称 `var(--fg)`；URL `var(--meta)`；操作组 `opacity:0` |
| Hover | 行 `background: color-mix(in srgb, var(--accent) 4%, transparent)`；操作组 `opacity:1` |
| Focus（键盘 ↑↓ 导航） | `:focus-visible` 行 `box-shadow: var(--focus-ring)` |
| Selected（键盘 / 点击当前项） | 行 `background: color-mix(in srgb, var(--accent) 8%, transparent)`；名称 `color: var(--accent)` |
| Loading（抓取中） | favicon 处 Lucide `loader` 旋转（spin 150ms） |
| Empty（无匹配） | 主区居中：「没有匹配的网址」+ Ghost 按钮「清除搜索」 |
| Error | favicon 回退 monogram；打开失败 toast（`var(--danger)` 边框） |

### 1.8 真实样例数据（渲染参考，禁占位）
分类与计数（有机感，非光鲜指标）：
- 全部 107 · 开发 47 · 设计 23 · 阅读 8 · 工具 15 · 社交 9 · 未分类 5

UrlRow 样例（名称 / URL / 分类）：
- GitHub / github.com / 开发
- Figma / figma.com / 设计
- Notion / notion.so / 笔记
- YouTube / youtube.com / 娱乐
- 内部 Wiki / wiki.corp.example / 工具

---

## 2. AddUrlDialog（添加网址）

### 2.1 容器
- 模态覆盖层（应用内 overlay 或独立子窗）；居中，`width: 360px`
- `background: var(--surface)`；`border-radius: var(--panel-radius)`(16px)；`border: 1px solid var(--border)`；`box-shadow: var(--elev-raised)`
- `padding: var(--space-6)`(24px)
- `display:flex; flex-direction:column; gap: var(--space-5)`(20px)

### 2.2 头部
- 标题「添加网址」：`font-size: var(--text-xl)`(18px)；`font-weight: 590`；`color: var(--fg)`
- 右 `x` 20px 关闭按钮（同 §1.2 图标按钮样式）

### 2.3 字段
通用 Input 样式：
- `background: var(--surface-warm)`；`border: 1px solid var(--border)`；`border-radius: var(--radius-sm)`(8px)
- `padding: var(--space-2)`(8px) `var(--space-3)`(12px)；`font: var(--font-body)`；`font-size: var(--text-base)`(14px)；`color: var(--fg)`
- 占位符 `color: var(--meta)`
- Focus：`border-color: var(--accent)`；`box-shadow: var(--focus-ring)`

字段清单：
1. **名称（选填）**
   - label「名称（选填）」：`font-size: var(--text-sm)`(13px)；`color: var(--fg-2)`；`font-weight: 510`
   - 占位符「留空则自动抓取网页标题」
2. **URL（必填）**
   - label「URL」
   - 占位符「https://example.com」；`font-family: var(--font-mono)`
   - 校验：必须 `^https?://` 开头；提交 / 失焦时非法则：
     - 输入框 `border-color: var(--danger)`
     - 错误文案「请输入以 http:// 或 https:// 开头的网址」，`color: var(--danger)`，`font-size: var(--text-xs)`(12px)
     - `aria-invalid="true"`；`aria-describedby` 指向错误文案 id
3. **分类（下拉）**
   - label「分类」
   - Select：选项 = 用户分类 + 「未分类」（默认选中）；`background: var(--surface-warm)`；右侧 Lucide `chevron-down` 20px `color: var(--muted)`

### 2.4 按钮行
- 右对齐，`display:flex; gap: var(--space-2)`(8px)
- 「取消」：Secondary Button
- 「确认」：Primary Button（accent 实心，可加 Lucide `check` 20px）；URL 非法时禁用（`opacity` 降低 + `cursor:not-allowed`）

### 2.5 交互
- 打开时焦点置于 URL 输入框
- Enter（URL 框内）触发确认
- Esc 关闭；焦点陷阱（focus trap）；`prefers-reduced-motion` 下淡入无位移

---

## 3. ImportDialog（导入书签）

### 3.1 容器
- 同 AddUrlDialog 模态；`width: 400px`

### 3.2 内容
- 标题「导入书签」
- **文件选择**：Secondary Button「选择文件」（Lucide `folder-open` 20px）→ 调 `tauri-plugin-dialog` 打开文件框，过滤 `*.html`
  - 已选文件显示：`font-family: var(--font-mono)`；`color: var(--muted)`；`font-size: var(--text-sm)`(13px)；显示文件名（截断）
- **进度条**（导入中）：
  - 轨道：`height: 6px`；`background: var(--surface-warm)`；`border-radius: var(--radius-pill)`
  - 填充：`background: var(--accent)`；`border-radius: var(--radius-pill)`；`transition: width var(--motion-base) var(--ease-standard)`
  - 大文件(>5000)显示 indeterminate（循环动画），不卡 UI
- **结果（成功）**：「已导入 N 条，跳过 M 条重复」，`color: var(--success)`，`font-size: var(--text-sm)`(13px)，前缀 Lucide `check` 16px `color: var(--success)`
- **错误态**：「文件已损坏或不是有效的 Netscape 书签文件」，`color: var(--danger)`，前缀 Lucide `alert-triangle` 16px `color: var(--danger)`

### 3.3 按钮行
- 「取消」Secondary；「开始导入」Primary（选定文件前禁用）
- 导入完成后按钮变「完成」Primary 关闭

---

## 4. SettingsDialog（设置）

### 4.1 容器
- 模态；`width: 440px`；分节布局

### 4.2 分区
每节：`display:flex; flex-direction:column; gap: var(--space-2)`(8px)；节间 `gap: var(--space-5)`(20px)
节标题：`font-size: var(--text-sm)`(13px)；`font-weight: 510`；`color: var(--fg-2)`

1. **唤出快捷键**
   - 录制框：显示当前组合（如「Alt + Space」），`font-family: var(--font-mono)`；`background: var(--surface-warm)`；`border: 1px solid var(--border)`；`border-radius: var(--radius-sm)`；`padding: var(--space-2)`(8px) `var(--space-3)`(12px)；`color: var(--fg)`
   - 「录制」按钮（Secondary，Lucide `keyboard` 20px）切换捕获；捕获中显示「按下组合键…」
   - **IME / 保留组合冲突**：检测系统保留（如 Ctrl+Space 输入法切换）或非法组合 → 框 `border-color: var(--danger)`；红字「该组合被系统保留（输入法切换），不可使用」`color: var(--danger)`；「保存」按钮禁用
2. **默认浏览器**
   - Select：选项 = 自动探测 `chrome` / `msedge` / `firefox` + 「系统默认」 + 「自定义路径…」
   - 选「自定义路径…」展开路径 Input（Lucide `folder-open` 选文件）
3. **开机自动启动**
   - 标签「开机自动启动」+ Switch 开关
   - Switch：轨道 `width:40px; height:22px; border-radius: var(--radius-pill)`；off `background: var(--border)`，on `background: var(--accent)`；旋钮 `18px` 白圆 `transition: transform var(--motion-fast)`；`role="switch"` `aria-checked`
4. **数据**
   - 「导出 JSON」（Secondary，Lucide `download` 20px）→ 下载 `links.json`
   - 「导入 JSON」（Secondary，Lucide `upload` 20px）→ 文件框选 JSON

### 4.3 按钮行
- 「取消」Secondary；「保存」Primary（冲突态禁用）

---

## 5. EmptyState（内嵌于 LauncherPanel，无数据时）

### 5.1 容器
- 替换 UrlList 主区；`display:flex; flex-direction:column; align-items:center; justify-content:center; gap: var(--space-4)`(16px)
- `padding: var(--space-8)`(32px)；文本居中

### 5.2 内容
- 图标：Lucide `bookmark` **24px**，`color: var(--meta)`
- 标题：「还没有网址」，`font-size: var(--text-lg)`(16px)；`font-weight: 510`；`color: var(--fg)`
- 描述：「添加一个网址，或导入浏览器书签开始整理。」，`color: var(--muted)`，`font-size: var(--text-sm)`(13px)，`line-height: var(--leading-body)`
- 主按钮「添加第一个网址」：Primary（Lucide `plus` 20px）→ 打开 AddUrlDialog
- 次按钮「导入书签」：Secondary（Lucide `upload` 20px）→ 打开 ImportDialog

### 5.3 无匹配态（搜索过滤为空，区别于总空态）
- 居中：「没有匹配的网址」，`color: var(--muted)`，`font-size: var(--text-base)`(14px)
- Ghost 按钮「清除搜索」→ 清空搜索框并复位列表

---

## 6. 页面实现提示词（交前端直接落地）

### 6.1 组件树
```
<LauncherPanel>                         // 浮窗容器 (fixed, top/right 16px)
 ├─ <Header>
 │   ├─ <SearchBar>                     // input + search(20) + focus ring
 │   └─ <IconButton gear(20)> <IconButton x(20)>
 ├─ <Body flex>
 │   ├─ <CategorySidebar w=168>
 │   │   └─ <CategoryItem> × N          // folder(16) + name + count(mono)
 │   └─ <UrlList role=listbox>
 │       ├─ <UrlRow role=option> × N     // favicon(20)/monogram/loader
 │       │   ├─ name(13/510) + url(mono 11/meta)
 │       │   ├─ <CategoryPill>
 │       │   └─ <ActionGroup>            // external-link/pencil/copy/trash(16)
 │       ├─ <EmptyState>  (total=0)
 │       └─ <NoMatchState> (filtered=0)
 └─ <FooterAddBar>
     ├─ <PrimaryButton plus(20) 添加网址>
     ├─ <SecondaryButton upload(20) 导入>
     └─ 拖拽提示文案
 <AddUrlDialog>  <ImportDialog>  <SettingsDialog>   // 模态覆盖层
```

### 6.2 关键 Props（TypeScript 摘要）
```ts
type Category = { id: string; name: string; icon?: string; count: number };
type UrlItem = { id: string; title: string; url: string; categoryId: string | null; faviconPath?: string };

// LauncherPanel
<LauncherPanel
  categories: Category[]
  urls: UrlItem[]
  activeCategoryId: string          // 'all' | categoryId | 'uncategorized'
  query: string
  selectedIndex: number            // 键盘导航当前项
  onQueryChange: (q: string) => void
  onSelectCategory: (id: string) => void
  onOpenUrl: (item: UrlItem) => void
  onAddUrl: () => void
  onImport: () => void
  onSettings: () => void
  onClose: () => void
/>

// UrlRow
<UrlRow item={UrlItem} selected={boolean}
  actions={{ onOpen, onEdit, onCopy, onDelete }} />

// AddUrlDialog
<AddUrlDialog open categories
  onConfirm({ title?, url, categoryId }) onCancel />
// ImportDialog
<ImportDialog open onPickFile onImport(path) => { imported, skipped } onCancel />
// SettingsDialog
<SettingsDialog open settings
  onSave(Settings) onCancel
  hotkeyConflict: (combo: string) => boolean />
```

### 6.3 键盘与交互模型
- **唤出 / 隐藏**：全局 `Alt+Space`（Rust 侧）；面板内 `Esc` 隐藏（AC-02）
- **搜索**：输入即过滤（≤50ms，AC-04）；`Ctrl+K` 聚焦搜索框
- **列表导航**：`↑` / `↓` 移动 `selectedIndex`（clamp，不循环）；`Enter` 打开当前项（AC-05）
- **对话框**：`Esc` 关闭；`Tab` 焦点陷阱；Enter 在 URL 框触发确认
- **拖拽**：窗口级 drag-drop 双通道（paths + `text/uri-list`）；拖入时显示 §1.6 遮罩
- **动画**：进入 / 关闭 `var(--motion-base)` 透明度 + 位移；`prefers-reduced-motion` 仅透明度

### 6.4 Token 速查（前端 import 引用）
- 颜色全部 `var(--*)`；强调 tint 用 `color-mix(in srgb, var(--accent) N%, transparent)`
- 字号：`--text-xs`12 / `--text-sm`13 / `--text-base`14 / `--text-lg`16 / `--text-xl`18
- 间距：`--space-1`4 / `--space-2`8 / `--space-3`12 / `--space-4`16 / `--space-5`20 / `--space-6`24 / `--space-8`32
- 圆角：`--radius-sm`8 / `--radius-md`12 / `--radius-lg`16 / `--radius-pill`9999
- 动效：`--motion-fast`150ms / `--motion-base`200ms / `--ease-standard`
- 焦点：`--focus-ring`；层级：`--elev-raised`
- 布局：`--panel-w`520 / `--panel-max-h`88vh / `--sidebar-w`168 / `--row-min-h`44

### 6.5 禁止清单（前端自查）
- 禁止在组件写死 hex 颜色（除 `#fff` 作 accent-on）
- 禁止 emoji 图标（一律 Lucide，尺寸 16 / 20 / 24）
- 禁止紫粉渐变、毛玻璃、发光边框
- 禁止占位文案（用真实样例数据与真实动作）
- 禁止 >1px 彩色边条作选中强调（用背景 tint）
- 禁止卡片圆角 ≥24px
