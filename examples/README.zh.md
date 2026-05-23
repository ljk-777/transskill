# TransSkill 示例

> [English Examples](README.md)

本目录包含 TransSkill 的使用示例。

## 文件转换

### .cursorrules → SKILL.md

```bash
# 将 Cursor 规则转换为可移植的 SKILL.md
transskill convert .cursorrules --to skill.md -o portable-skill.md
```

### SKILL.md → .cursorrules

```bash
# 将 SKILL.md 转换为 Cursor 规则
transskill convert my-skill.skill.md --to .cursorrules -o .cursorrules
```

### SKILL.md → .mdc（带文件范围）

```bash
# 生成限定 TypeScript 文件的 Cursor 2.3+ 规则
transskill convert my-skill.skill.md --to .mdc --glob "src/**/*.ts"
```

## 目录转换

```bash
# 完整 skill 目录 → Cursor 规则
transskill convert ./weather-skill/ --to .cursorrules
```

## GitHub 源

```bash
# GitHub 缩写格式
transskill convert gh:user/weather-skill --to skill.md

# 直接安装
transskill convert gh:user/weather-skill --to .cursorrules --install-to .cursor/rules/
```
