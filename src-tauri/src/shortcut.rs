//! shortcut.rs — 全局快捷键录制与 IME 保留组合检测
//!
//! 背景（spec §11 已知坑：全局快捷键 IME 冲突）：Ctrl+Space 是 Windows 输入法切换键，
//! 若注册为面板唤出键会与系统冲突。录制阶段必须检测并禁止保存此类系统保留组合。
//!
//! 契约：
//! - `validate_shortcut(combo: &str) -> Result<(), ShortcutError>`
//! - 前端录制时组装 'Mod+Key' 字符串（见下方 `FRONTEND_RECORDING` 约定），
//!   调用本函数（经由 settings_set 前的校验命令，或直接复用本逻辑）确认合法后才持久化。
//! - 合法组合示例："Ctrl+Alt+Space"（默认）、"Ctrl+Shift+K"、"Alt+D"。
//! - 合法修饰符：Alt / Ctrl / Shift / Super（单键组合需至少含一个修饰符，纯字母键不允许）。

use serde::Serialize;

/// 快捷键校验失败原因。
#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
pub enum ShortcutError {
    /// 格式非法（不是 'Mod+Key'）
    InvalidFormat,
    /// 修饰符缺失（纯主键，如 "A"）
    MissingModifier,
    /// 未知的修饰符或键名
    UnknownToken(String),
    /// 系统保留组合（IME / 系统快捷键），禁止占用
    SystemReserved(String),
    /// 主键缺失
    MissingKey,
}

impl std::fmt::Display for ShortcutError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ShortcutError::InvalidFormat => write!(f, "快捷键格式应为 'Mod+Key'"),
            ShortcutError::MissingModifier => write!(f, "快捷键必须包含修饰符（Alt/Ctrl/Shift/Super）"),
            ShortcutError::UnknownToken(t) => write!(f, "无法识别的按键: {t}"),
            ShortcutError::SystemReserved(c) => write!(f, "系统保留组合，不可占用（IME/系统快捷键）: {c}"),
            ShortcutError::MissingKey => write!(f, "快捷键缺少主键"),
        }
    }
}

impl std::error::Error for ShortcutError {}

/// Windows 平台系统保留组合（与输入法/系统冲突，禁止注册为面板唤出键）。
/// 来源：Windows 全局快捷键约定 + spec §11 IME 冲突坑。
const RESERVED_COMBOS: &[&str] = &[
    "Ctrl+Space",    // 输入法切换
    "Alt+Shift",     // 输入法/语言切换
    "Ctrl+Shift",    // 输入法切换（部分区域）
    "Win+Space",     // 语言切换
    "Win+L",         // 锁屏
    "Win+R",         // 运行
    "Win+E",         // 资源管理器
    "Win+D",         // 显示桌面
    "Alt+Tab",       // 任务切换
    "Ctrl+Esc",      // 开始菜单
    "Win",           // 单独 Win 键
];

/// 修饰符白名单（大小写不敏感）。
const MODIFIERS: &[&str] = &["alt", "ctrl", "control", "shift", "super", "meta", "cmd", "win"];

/// 校验快捷键组合字符串（如 "Ctrl+Alt+Space"）。
///
/// 返回 `Ok(())` 表示可安全注册；否则 `Err(ShortcutError)`。
pub fn validate_shortcut(combo: &str) -> Result<(), ShortcutError> {
    let combo = combo.trim();
    if combo.is_empty() {
        return Err(ShortcutError::InvalidFormat);
    }

    // 单独 Win 键（无主键）直接视为保留
    if combo.eq_ignore_ascii_case("win") {
        return Err(ShortcutError::SystemReserved(combo.to_string()));
    }

    // 按 '+' 拆分，最后一段是主键，其余是修饰符
    let parts: Vec<&str> = combo.split('+').map(|p| p.trim()).filter(|p| !p.is_empty()).collect();
    if parts.len() < 2 {
        // 只有一个 token：若它是修饰符则缺主键，若是主键则缺修饰符
        return if MODIFIERS.contains(&parts[0].to_ascii_lowercase().as_str()) {
            Err(ShortcutError::MissingKey)
        } else {
            Err(ShortcutError::MissingModifier)
        };
    }

    let key = parts.last().unwrap();
    let mods = &parts[..parts.len() - 1];

    // 主键不能是修饰符
    if MODIFIERS.contains(&key.to_ascii_lowercase().as_str()) {
        return Err(ShortcutError::MissingKey);
    }
    // 主键不能为空
    if key.is_empty() {
        return Err(ShortcutError::MissingKey);
    }

    // 所有修饰符必须已知
    for m in mods {
        if !MODIFIERS.contains(&m.to_ascii_lowercase().as_str()) {
            return Err(ShortcutError::UnknownToken(m.to_string()));
        }
    }

    // 系统保留组合检测（规范化为稳定形式后比对）
    let normalized = normalize(combo);
    if RESERVED_COMBOS.iter().any(|r| normalize(r) == normalized) {
        return Err(ShortcutError::SystemReserved(combo.to_string()));
    }

    Ok(())
}

/// 把组合规范化为可比对形式：修饰符按固定顺序、统一为 alt/ctrl/shift/super。
fn normalize(combo: &str) -> String {
    let mut mods = vec![false; 4]; // alt, ctrl, shift, super
    let mut key = String::new();
    for p in combo.split('+').map(|s| s.trim()).filter(|s| !s.is_empty()) {
        match p.to_ascii_lowercase().as_str() {
            "alt" => mods[0] = true,
            "ctrl" | "control" => mods[1] = true,
            "shift" => mods[2] = true,
            "super" | "meta" | "cmd" | "win" => mods[3] = true,
            other => key = other.to_string(),
        }
    }
    let mut out = String::new();
    if mods[0] { out.push_str("Alt+"); }
    if mods[1] { out.push_str("Ctrl+"); }
    if mods[2] { out.push_str("Shift+"); }
    if mods[3] { out.push_str("Super+"); }
    out.push_str(&key);
    out
}

// ===========================================================================
// FRONTEND_RECORDING 约定（前端录制实现参考，不在 Rust 侧）
// ---------------------------------------------------------------------------
// 1. 监听 keydown，收集 e.key / e.code，忽略 repeat。
// 2. 修饰符映射：
//      Alt   -> "Alt"
//      Control -> "Ctrl"
//      Shift -> "Shift"
//      Meta  (Win) -> "Super"
// 3. 主键映射（用 KeyboardEvent.code 避免输入法/布局干扰）：
//      "KeyA".."KeyZ" -> "A".."Z"
//      "Digit0".."Digit9" -> "0".."9"
//      "Space" -> "Space"
//      "Enter" -> "Enter"  等
// 4. 组装字符串：修饰符按 Alt/Ctrl/Shift/Super 顺序用 '+' 连接，再 '+' 主键，
//    例：Alt+Space、Ctrl+Shift+K。
// 5. 调 validate_shortcut（经 settings 校验命令或复用本逻辑）通过后才写入 Settings.hotkey；
//    失败则提示对应 ShortcutError（如 IME 冲突禁止保存，spec §11）。
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn accepts_default() {
        assert!(validate_shortcut("Alt+Space").is_ok());
    }
    #[test]
    fn rejects_ime_conflict() {
        assert_eq!(validate_shortcut("Ctrl+Space"), Err(ShortcutError::SystemReserved("Ctrl+Space".into())));
    }
    #[test]
    fn rejects_plain_key() {
        assert_eq!(validate_shortcut("A"), Err(ShortcutError::MissingModifier));
    }
    #[test]
    fn rejects_unknown_mod() {
        assert!(matches!(validate_shortcut("Foo+K"), Err(ShortcutError::UnknownToken(_))));
    }
}
