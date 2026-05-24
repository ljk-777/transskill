# 已知 Bug

记录 TransSkill 项目中的已知问题，待修复。

---

| ID | 描述 | 严重度 | 影响范围 | 创建日期 | 状态 |
|:---|:-----|:------:|:---------|:--------:|:----:|
| AUDIT-i18n-001 | ~~文字混排~~：`t()` 新增 4 级匹配策略（精确→引用后缀→引用前缀→冒号前缀），变量拼接字符串也能正确翻译 | medium | `transskill audit --lang en` | 2026-05-24 | ✅ v0.2.6 |
| AUDIT-i18n-002 | ~~语言检测不准~~：`isChinese()` 已删，改为直接使用 `--lang` 选项 | low | `transskill audit` | 2026-05-24 | ✅ v0.2.5 |
| AUDIT-SCOPE-003 | **扫描范围越界**：对单文件执行 `transskill audit test.md` 时，额外输出了其他目录（`sus-skill/`）的发现，路径解析或扫描范围有问题 | high | `transskill audit <file>` | 2026-05-24 | ⏳ 待修复 |
| CLI-OUTPUT-004 | **其他界面输出仍用旧风格 emoji**：`list-formats`（📦）、`convert`（✅❌⚠️）、`diff`（✅❌）、`validate`（✅❌）等命令的输出仍使用 emoji 装饰，与 audit 新风格不统一 | medium | `transskill convert / diff / list-formats / validate` | 2026-05-24 | ⏳ 待修复 |

## 严重度定义

- **critical**: 功能不可用 / 数据错误
- **high**: 功能明显异常
- **medium**: 功能异常但可绕开
- **low**: 体验问题 / UI 瑕疵
