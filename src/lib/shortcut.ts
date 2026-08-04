// 全局快捷键录制与 IME 保留组合检测（前端镜像 src-tauri/src/shortcut.rs）。
// 录制阶段在前端组装 'Mod+Key' 字符串并先用本函数校验，冲突则禁止保存，
// 逻辑与 Rust validate_shortcut 保持一一对应。

export type ShortcutErrorKind =
  | 'InvalidFormat'
  | 'MissingModifier'
  | 'UnknownToken'
  | 'SystemReserved'
  | 'MissingKey';

export interface ShortcutCheck {
  ok: boolean;
  /** 人类可读错误（用于红字提示） */
  message?: string;
  kind?: ShortcutErrorKind;
}

// Windows 系统保留组合（与输入法 / 系统冲突，禁止占用）。
const RESERVED_COMBOS: string[] = [
  'Ctrl+Space', // 输入法切换
  'Alt+Shift', // 输入法 / 语言切换
  'Ctrl+Shift', // 输入法切换（部分区域）
  'Win+Space', // 语言切换
  'Win+L', // 锁屏
  'Win+R', // 运行
  'Win+E', // 资源管理器
  'Win+D', // 显示桌面
  'Alt+Tab', // 任务切换
  'Ctrl+Esc', // 开始菜单
  'Win', // 单独 Win 键
];

const MODIFIERS: string[] = [
  'alt', 'ctrl', 'control', 'shift', 'super', 'meta', 'cmd', 'win',
];

function normalize(combo: string): string {
  const mods = [false, false, false, false]; // alt, ctrl, shift, super
  let key = '';
  for (const raw of combo.split('+').map((s) => s.trim()).filter(Boolean)) {
    switch (raw.toLowerCase()) {
      case 'alt': mods[0] = true; break;
      case 'ctrl':
      case 'control': mods[1] = true; break;
      case 'shift': mods[2] = true; break;
      case 'super':
      case 'meta':
      case 'cmd':
      case 'win': mods[3] = true; break;
      default: key = raw; break;
    }
  }
  let out = '';
  if (mods[0]) out += 'Alt+';
  if (mods[1]) out += 'Ctrl+';
  if (mods[2]) out += 'Shift+';
  if (mods[3]) out += 'Super+';
  out += key;
  return out;
}

/** 校验快捷键组合字符串，返回是否可安全注册。 */
export function validateShortcut(combo: string): ShortcutCheck {
  const c = combo.trim();
  if (!c) return { ok: false, kind: 'InvalidFormat', message: '快捷键格式应为 Mod+Key' };

  if (c.toLowerCase() === 'win') {
    return { ok: false, kind: 'SystemReserved', message: '单独 Win 键被系统占用' };
  }

  const parts = c.split('+').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) {
    const only = parts[0]?.toLowerCase();
    if (only && MODIFIERS.includes(only)) {
      return { ok: false, kind: 'MissingKey', message: '快捷键缺少主键' };
    }
    return { ok: false, kind: 'MissingModifier', message: '必须包含修饰符（Alt/Ctrl/Shift/Super）' };
  }

  const key = parts[parts.length - 1];
  const mods = parts.slice(0, -1);

  if (key && MODIFIERS.includes(key.toLowerCase())) {
    return { ok: false, kind: 'MissingKey', message: '快捷键缺少主键' };
  }
  if (!key) {
    return { ok: false, kind: 'MissingKey', message: '快捷键缺少主键' };
  }
  for (const m of mods) {
    if (!MODIFIERS.includes(m.toLowerCase())) {
      return { ok: false, kind: 'UnknownToken', message: `无法识别的按键: ${m}` };
    }
  }

  const normalized = normalize(c);
  if (RESERVED_COMBOS.some((r) => normalize(r) === normalized)) {
    return {
      ok: false,
      kind: 'SystemReserved',
      message: '该组合被系统保留（输入法切换），不可使用',
    };
  }

  return { ok: true };
}
