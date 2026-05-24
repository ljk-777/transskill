/**
 * Marketplace types for skill metadata and registry.
 */

export interface SkillManifest {
  name: string;
  version: string;
  description: string;
  tags: string[];
  author: string;
  stars: number;
  auditScore: number;
  created: string;
}

export interface RegistryIndex {
  $schema: string;
  updated: string;
  skills: SkillManifest[];
}

export interface SkillDetail extends SkillManifest {
  /** Full content of SKILL.md */
  readme: string;
  /** Raw download URL for the SKILL.md */
  downloadUrl: string;
}
