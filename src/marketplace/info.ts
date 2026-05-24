import type { SkillDetail, SkillManifest } from './types.js';
import { getRegistry, findSkill, getSkillDetail } from './registry-client.js';

/**
 * Show detailed info about a skill.
 */
export async function showSkillInfo(name: string): Promise<void> {
  const registry = await getRegistry();
  const manifest = findSkill(registry, name);

  if (!manifest) {
    console.log(`Skill "${name}" not found in registry.`);
    console.log('Try `transskill search` to find available skills.');
    return;
  }

  const detail = await getSkillDetail(manifest);

  console.log('');
  console.log(`  ${detail.name}  v${detail.version}`);
  console.log(`  ${'─'.repeat(40)}`);
  console.log(`  ${detail.description}`);
  console.log('');
  console.log(`  Author:     ${detail.author}`);
  console.log(`  Stars:      ${detail.stars}`);
  console.log(`  Audit:      ${detail.auditScore}/100`);
  console.log(`  Tags:       ${detail.tags.join(', ')}`);
  console.log(`  Published:  ${detail.created.slice(0, 10)}`);
  console.log('');
  console.log(`  ${'─'.repeat(40)}`);
  console.log(detail.readme.slice(0, 2000));
  if (detail.readme.length > 2000) {
    console.log(`\n  ... (${detail.readme.length - 2000} more chars)`);
  }
  console.log('');
}
