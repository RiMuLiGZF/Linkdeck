# ADR-003: 图标库锁定 — lucide-react@1.24.0（禁止 emoji）

- **Status**: Accepted（草案）
- **Date**: 2026-08-02
- **Deciders**: 高见远（架构师）

## Background
P0 强制要求：锁定一套 SVG 图标库；禁止 emoji 作为功能图标；禁止硬编码颜色值（除 #fff/#000）。

## Decision
锁定 **lucide-react@1.24.0** 为全项目唯一图标来源；经 `components/Icon.tsx` 统一封装；若实现期 1.x 有重大破坏性变更，回退 `0.561.0`（命名导入 API 一致）。**全项目禁止 emoji 作为功能图标。**

## Consequences
- 正面：树摇友好、风格统一、与 React 原生契合、SVG 可控色（经 currentColor/CSS 变量，不硬编码 hex）。
- 负面：非常规图标需等上游或自绘 SVG。
- 相关：designer 须在 `lib/design-tokens.css` 定义颜色 CSS 变量，组件不得裸写 hex（除 #fff/#000）。
