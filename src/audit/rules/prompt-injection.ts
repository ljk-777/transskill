import type { Severity } from '../auditor.interface.js';

export interface PromptInjectionRule {
  id: string;
  pattern: RegExp;
  severity: Severity;
  description: string;
  recommendation: string;
  cwe?: string;
}

/**
 * Rules for detecting prompt injection and system override attempts
 * in agent skill instructions.
 */
export const PROMPT_INJECTION_RULES: PromptInjectionRule[] = [
  // ── System override attempts ──
  {
    id: 'L1-010a',
    pattern: /ignore\s+(?:all\s+)?(?:previous|above|your|my|the)\s+(?:instructions?|directives?|rules?|commands?|prompts?|orders?)/i,
    severity: 'high',
    description: '尝试覆盖/忽略系统指令，典型的 prompt 注入模式',
    recommendation: '正常 skill 不应要求忽略已有指令',
    cwe: 'CWE-940',
  },
  {
    id: 'L1-010b',
    pattern: /(?:SYSTEM|SYS)\s*(?:OVERRIDE|MODE|PROMPT|COMMAND)[:\s]/i,
    severity: 'high',
    description: '模拟系统级指令覆盖，可能是恶意注入',
    recommendation: '正常 skill 不应模拟系统指令',
    cwe: 'CWE-940',
  },
  {
    id: 'L1-010c',
    pattern: /\byou\s+(?:are\s+)?(?:now|must|will|should)\s+(?!be|not|only|able)(?:a\s+)?(?:free|released|unleashed|unconstrained|uncensored|unfiltered|ungoverned|unrestricted)\b/i,
    severity: 'high',
    description: '尝试"释放"AI 约束，典型 jailbreak 模式',
    recommendation: '合法 skill 不应试图解除 AI 约束',
    cwe: 'CWE-940',
  },
  {
    id: 'L1-010d',
    pattern: /\b(?:disregard|forget|erase|delete|remove|overwrite)\s+(?:all|previous|above|the)\s+(?:instructions?|rules?|context|memory|prompts?)/i,
    severity: 'high',
    description: '试图清除 AI 上下文或记忆',
    recommendation: '正常 skill 不应要求清除上下文或记忆',
    cwe: 'CWE-940',
  },

  // ── Role manipulation ──
  {
    id: 'L1-010e',
    pattern: /\byou\s+(?:are\s+)?(?:now\s+)?(?:DAN|Jail(?:brea)?k|GPT-\d+Override|Developer\s+Mode)\b/i,
    severity: 'medium',
    description: '引用已知 jailbreak 角色（如 DAN/Developer Mode）',
    recommendation: '合法 skill 不应使用 jailbreak 角色设定',
    cwe: 'CWE-940',
  },
  {
    id: 'L1-010f',
    pattern: /\boutput\s+(?:your\s+)?(?:system\s+)?(?:prompt|instructions?|rules?)\s+(?:verbatim|exactly|as\s+is|at\s+the\s+beginning)/i,
    severity: 'medium',
    description: '试图提取系统提示词，可能是信息收集行为',
    recommendation: '正常 skill 不应尝试提取系统提示',
    cwe: 'CWE-200',
  },

  // ── Urgency manipulation ──
  {
    id: 'L1-010g',
    pattern: /\b(?:URGENT|IMPORTANT|CRITICAL|VITAL|ABSOLUTELY)\s*:\s*(?!NOTE|NOTEBOOK|REMINDER|ANNOUNCEMENT|UPDATE)/i,
    severity: 'low',
    description: '使用紧急/重要词汇引导 AI 行为（组合其他模式时风险更高）',
    recommendation: '避免在 skill 中使用过度强调性语言引导 AI',
  },
];
