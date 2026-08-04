# url-launcher 设计规范（DESIGN.md）

> 项目代号：url-launcher（建议产品名：**Linkdeck**，取"链接甲板 / 锚定右上角"之意）
> 形态：Windows 桌面端 · 系统托盘常驻 + 全局快捷键唤出 · 面板贴屏幕右上角的浮窗
> 寄存器：**Product Register**（设计服务产品，非营销页面——标杆是"赢得熟悉感"）
> 设计优先级：克制色彩 + 单一强调色 + 表面层级替代阴影 + 真实内容优先

---

## 1. Visual Theme & Atmosphere

- 视觉关键词（3-5 个）：**精密（precision）· 克制（restrained）· 即时（instant）· 安静（quiet）· 可信（trustworthy）**
- 氛围描述：像一把"桌面上的瑞士军刀"——浅色浮窗，中性灰白为底，唯一强调色只用于"当前选中 / 主操作 / 聚焦环"，其余层级完全靠**表面明度递进 + 1px 描边**表达。
- 关键设计哲学：**列表项的彩色 favicon 承担视觉多样性，chrome（界面框架）自身保持冷静**。这既避免 AI 模板味的色彩饱和，也让大量网址在视觉上井然有序。
- 对标参照（按相关度排序）：
  1. **Raycast / Flow Launcher** —— 全局快捷键唤出 + 单搜索框 + 列表驱动的"启动器"范式（本案的形态基线）
  2. **Linear** —— 克制单色强调 + 表面阶梯替代阴影 + Inter 负字距的"软件工艺感"
  3. **uTools** —— 中文桌面工具的真实范式（Alt+Space 唤出、悬浮球、拖入即存、本地存储）
- 明确**不**采用：营销型大图 Hero、紫粉渐变、emoji 图标、奶油/米色背景默认化。

---

## 2. Color Palette & Roles

> 浅色为主（默认主题）。深色主题作为次要主题在文末给出 A1 覆盖。
> 每屏可见 `--accent` 使用严格限制在**交互/选中态**（主操作按钮、当前选中项、聚焦环），**禁止**装饰性铺色。
> 所有颜色均通过 Token 引用，组件中**不得出现裸 hex**（唯一例外 `#fff`/`#000` 仅用于 accent-on 等语义固定的极少处）。

### A1-identity（品牌核心，不可省略）
| Token | 值 | 角色 |
|-------|-----|------|
| `--bg` | `#F3F4F6` | 浮窗之外的桌面底色 / 应用画布 |
| `--surface` | `#FFFFFF` | 浮窗根背景、卡片、行 |
| `--surface-warm` | `#F5F6F8` | 凹陷面：搜索框、输入框、侧栏底 |
| `--fg` | `#1B1D23` | 主文本（非纯黑，带冷调） |
| `--fg-2` | `#3C3F47` | 次级文本 |
| `--muted` | `#6B7280` | 三级文本 / URL |
| `--meta` | `#9AA0A8` | 四级文本 / 提示 |
| `--accent` | `#3B5BDB` | 强调色（**刻意调离 Tailwind 默认 `#6366F1`**，偏"墨蓝"，读作精密桌面工具） |
| `--accent-on` | `#FFFFFF` | accent 背景上的前景 |
| `--border` | `#E6E8EC` | 默认描边 |
| `--border-soft` | `#F0F1F4` | 内部行分隔 |

### A2（有默认值，品牌可覆盖）
| Token | 值 |
|-------|-----|
| `--accent-hover` | `#2F4BC4` |
| `--accent-active` | `#283FA8` |
| `--success` | `#1F9D55` |
| `--warn` | `#C2810B` |
| `--danger` | `#E5484D` |
| `--font-display` | `"Inter", "Noto Sans SC", -apple-system, "Segoe UI", system-ui, sans-serif` |
| `--font-body` | `"Inter", "Noto Sans SC", -apple-system, "Segoe UI", system-ui, sans-serif` |
| `--font-mono` | `"JetBrains Mono", "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace` |

### B-slot（品牌声明的别名）
`--fg-2 → var(--fg-2)`、`--surface-warm → var(--surface-warm)`、`--meta → var(--meta)`、`--border-soft → var(--border-soft)`

### 强调色使用纪律
- 主"添加网址"按钮（accent 实心）→ 1 处
- 当前选中分类 / 当前选中列表项（accent 8% 透明底 + accent 文字）→ 1 处集合
- 聚焦环（`--focus-ring`）→ 交互态，不计入装饰
- favicon 自带色彩 → 不属于 chrome 强调色，自由多彩

---

## 3. Typography Rules

- 字体栈：
  - `--font-display` / `--font-body`：`Inter` + `Noto Sans SC`（中文回退，`-apple-system` / `Segoe UI` 系统字体）
  - `--font-mono`：`JetBrains Mono` / `Geist Mono`（用于 URL、快捷键提示、计数）
- 字号层级（8 级，适配紧凑浮窗）：
  - `--text-xs` 12px · `--text-sm` 13px · `--text-base` 14px · `--text-lg` 16px
  - `--text-xl` 18px · `--text-2xl` 20px · `--text-3xl` 24px · `--text-4xl` 32px
- 行高：`--leading-body` 1.5 · `--leading-tight` 1.25
- 字距（工艺关键）：
  - 正文（13–16px）：`0`
  - 小字（≤12px）：`0.01em`
  - ALL CAPS / 快捷键标签：必须 `0.06em`
  - 标题（≥24px）：`-0.01em`
- 三级字重：Read(400) 正文 / Emphasize(510) 小标题·强调 / Announce(590–600) 大标题·主操作。中文用 Noto Sans SC 400/500/600 对应。
- 开启 Inter 的 OpenType 特性（`cv05`、`ss03`）以贴近"软件工艺"质感。
- 仅 2 种字体配对（display+body 视为同族 Inter；mono 不计入配对上限）。正文每行 50–75 字符。

---

## 4. Component Stylings

### 浮窗容器（Panel）
- 背景 `--surface`，圆角 `--panel-radius: 16px`，描边 `1px var(--border)`，浮起阴影 `--elev-raised`
- 宽 `--panel-w: 520px`（区间 480–560），高 `min(720px, 88vh)`，距屏幕上/右各 16px 锚定

### 搜索框（SearchField，顶部通栏）
- 背景 `--surface-warm`（凹陷感），圆角 `--radius-md`，内左侧 Lucide `search` 20px，右可放 `command`/`settings` 图标按钮
- 聚焦：`--focus-ring` + 背景转 `--surface`
- 占位符：`搜索网址或分类…`（真实动作文案，**禁止** Welcome to / 空洞词）

### 分类侧栏（CategorySidebar，左侧）
- 宽 `--sidebar-w: 168px`，背景 `--surface-warm`，右侧 1px `--border-soft` 分隔
- 项：Lucide 分类图标 16px + 名称（--text-sm）+ 计数（--font-mono --meta，右对齐）
- 选中：背景 `color-mix(--accent 8%, transparent)` + 名称 `--accent`；**禁止**用 >1px 彩色左条
- 项含：`全部` · 用户分类（开发/设计/阅读/工具/社交…）· `未分类`

### 网址列表项（UrlRow，右侧主区）
- 布局（左→右）：favicon(20px) · 主信息列（名称 --text-base + URL --text-xs --muted --font-mono 截断）· 分类标签（pill）· 悬浮操作组
- 行高 `--row-min-h: 44px`，hover 背景 `color-mix(--accent 4%, transparent)`
- 选中（键盘/点击）：背景 `color-mix(--accent 8%, transparent)` + 名称 `--accent` + 左侧 2px accent 指示**仅以背景+文字表达，不用厚描边**
- 分类标签：`--surface-warm` 底 + `--muted` 字 + `--radius-pill` + 左右 8px padding
- 悬浮操作组（Lucide，20px，默认隐藏 hover/聚焦显现）：`external-link`(打开) · `pencil`(编辑) · `copy`(复制) · `trash`(删除)
- favicon 抓取失败 → 回退为域名首字母 monogram（accent 或中性色圆角方块）

### 底部添加条（AddBar）
- 主操作：`plus` 图标 + "添加网址"（Primary Button，accent 实心）
- 次操作：`upload`(导入书签 HTML) · `folder-open`(批量) · 拖拽提示"将链接拖入此处"
- 拖入进行时：整面板描边变 `--accent` + 半透明 accent 遮罩提示放置区

### 按钮三态
- Primary：`--accent` 底 / `--accent-on` 字 / `--radius-sm` / hover `--accent-hover` / active `--accent-active`
- Secondary：透明 + `1px var(--border)` + `--fg` 字，hover 背景 `--surface-warm`
- Ghost：透明，hover 背景 `color-mix(--accent 4%, transparent)`

---

## 5. Layout Principles

**整体结构（右上角浮窗，竖向三段 + 中部左右分栏）：**

```
┌───────────────────────────────────────────┐  ← Panel (520px, 锚定 top:16 right:16)
│ [search 20px] 搜索网址或分类…        [设置][x] │  ← Header：搜索框通栏
├──────────────┬────────────────────────────┤
│ 全部       12 │ GitHub        github.com  开发   [打开][编辑][复制][删除] │
│ 开发       47 │ Figma         figma.com    设计   …              │
│ 设计       23 │ Notion        notion.so    笔记   …              │
│ 阅读        8 │ YouTube       youtube.com  娱乐   …              │
│ 工具       15 │ 内部 Wiki     wiki.corp    工具   …              │
│ 社交        9 │                                    │
│ 未分类      3 │                                    │
├──────────────┴────────────────────────────┤
│ [＋ 添加网址]   [⤓ 导入]   将链接拖入此处 →   │  ← Footer：添加入口
└───────────────────────────────────────────┘
```

- 栅格：浮窗内用弹性布局；侧栏固定 168px，主区 `flex:1` 可滚动
- 节区节奏（浮窗内）：区块间距 `--space-4`(16px)，列表项间距 `--space-1`(4px) 由分隔线表达
- 容器最大宽 `--panel-w: 520px`；沟槽 `--space-4`
- 真实内容：列表**默认填充真实样例网址**（GitHub / Figma / Notion / YouTube / 内部 Wiki 等）与真实分类与有机计数（47、23、8…），**禁止**虚构光鲜指标与占位文案

### 组件状态矩阵（UrlRow / CategorySidebar 必须覆盖）
| 状态 | 处理 |
|------|------|
| Default | 常规行 |
| Hover | 行底色微变 + 显现操作组 |
| Focus | `:focus-visible` 显示 `--focus-ring`（键盘上下导航） |
| Active/Selected | accent 8% 底 + accent 文字 |
| Loading | favicon 处显示 spinner（Lucide `loader` 旋转） |
| Empty（无匹配） | 主区居中："没有匹配的网址" + "添加网址" 主按钮引导 |
| Error | favicon 回退 monogram；行级错误（如打开失败）toast |
| Edge | 超长 URL 单行省略（`text-overflow: ellipsis`）；超长名称同；零结果/超大数据量虚拟滚动 |

---

## 6. Depth & Elevation

- 三级层级：
  - `--elev-flat: none`
  - `--elev-ring: 0 0 0 1px var(--border)`（卡片/输入框）
  - `--elev-raised: 0 12px 40px rgba(17,24,39,0.16), 0 2px 8px rgba(17,24,39,0.08)`（**浮窗浮于桌面，物理浮起，允许真实阴影**）
- 浅色主题用**描边 + 表面明度**承载层级，不用重阴影；仅浮窗本身用投影（因其确实浮在桌面之上，属功能而非装饰）
- 表面明度阶梯（浅色）：`--surface`(#FFF) → `--surface-warm`(#F5F6F8) → hover  tint(accent 4%) → selected tint(accent 8%)

---

## 7. Do's and Don'ts

通过 - 允许：
- 单一墨蓝强调色，仅用于交互/选中
- 列表项用真实 favicon 提供色彩多样性
- 1px 描边 + 表面明度表达层级
- 键盘可达（↑↓ 移动、Enter 打开、Ctrl+K 聚焦搜索、Esc 关闭）
- 圆角 8–16px，卡片不超过 16px

禁止（7 大罪 + 团队红线）：
- 禁止: emoji 作功能图标（必须用 Lucide）
- 禁止: 紫→粉渐变 + 发光边框 + 毛玻璃三位一体
- 禁止: "Welcome to" / "Lorem ipsum" / 空洞占位
- 禁止: 组件中硬编码 hex 颜色（必须经 Token）
- 禁止: 营销型 Hero 大图（这是工具浮窗，展示真实列表）
- 禁止: >1px 彩色左/右边条作强调（用背景 tint 替代）
- 禁止: 渐变文字（`background-clip:text`）
- 禁止: 卡片圆角 ≥24px、幽灵卡片（1px 边框 + blur≥16px 阴影同现）
- 禁止: 每屏超过 2 处可见 accent 装饰性使用

---

## 8. Responsive Behavior

- 形态为桌面浮窗，主断点：**1280 / 1024 / 768** 屏宽
- ≥1024px：完整布局（侧栏 168px + 列表）
- 768–1024px：侧栏收窄至 140px，或折叠为顶部横向分类 tab
- <768px（极小屏/平板模式）：侧栏转为顶部可横滑分类 chips，列表单列
- 触摸目标：行高 ≥44px，图标按钮点击区 ≥32×32（桌面鼠标环境，保持舒适）
- 浮窗始终锚定**右上角**，距边 16px；多显示器下记住最后所在屏

---

## 9. Agent Prompt Guide（给前端/架构的实现提示）

- 技术栈建议（Windows 本地优先、零后端）：**Tauri 2 + WebView2**（资源占用低，贴合"托盘常驻"），或 Electron 备选。UI 用原生 DOM/CSS 或 React。
- 图标：**Lucide** 全项目统一。`lucide-react`（若用 React）或 `lucide-static` 内联 SVG（若用原生）。尺寸规范：**16px（行内/侧栏项）· 20px（按钮内/搜索框）· 24px（独立图标）**，stroke 2，currentColor 继承 `--fg`/`--accent`。
- Token 消费：前端 `import tokens from './design-tokens.json'`（见同目录 sidecar），样式变量来自 `tokens.css` 的 `:root`。**禁止在组件里写死颜色**。
- 面板定位：用 Tauri Window 的 `setPosition` 锚定右上；全局快捷键 `Alt+Space` 或自定义（参考 uTools/Flow）。
- favicon 抓取：本地优先，主用 `https://www.google.com/s2/favicons?domain=...&sz=32`（或自托管缓存到本地 `app_data`），失败回退 monogram。
- 无障碍：列表 `role="listbox"` + 项 `role="option"` + `aria-selected`；搜索框 `aria-label`；图标按钮必须有 `aria-label`（无文字标签时）；支持 `prefers-reduced-motion`。
- 动效：进入 150–200ms `cubic-bezier(0.2,0,0,1)`；favicon spinner 用 Lucide `loader` 旋转；尊重 reduced-motion。

---

## 次要主题：深色覆盖（Windows 用户常开深色，建议二期支持）
```css
:root[data-theme="dark"] {
  --bg: #0D1117;
  --surface: #161B22;
  --surface-warm: #21262D;
  --fg: #F0F6FC;  --fg-2: #D0D6E0;  --muted: #8B949E;  --meta: #6E7681;
  --accent: #5B7CFA;  --accent-on: #FFFFFF;
  --accent-hover: #6E8BFF;  --accent-active: #4A6AE8;
  --border: #30363D;  --border-soft: rgba(255,255,255,0.05);
  --success: #3FB950;  --warn: #D29922;  --danger: #F85149;
  --elev-raised: 0 12px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4);
  --focus-ring: 0 0 0 3px rgba(91,124,250,0.4);
}
```
