/**
 * Marketplace types — v2: lightweight index (links only, no file storage).
 *
 * The registry is just a curated index of where skills live,
 * not a copy of the skill files themselves.
 */

/**
 * A skill entry in the registry index.
 * Points to the original source — no files are stored in the registry repo.
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
  /** URL to the original skill source (e.g. GitHub repo page) */
  sourceUrl: string;
  /** URL to download the SKILL.md file directly */
  downloadUrl: string;
  /** Optional: where this entry was sourced from */
  source?: 'registry' | 'awesome-agent-skills' | 'officialskills.sh' | 'github' | 'manual';
}

export interface RegistrySource {
  name: string;
  type: string;
  url: string;
  description?: string;
}

export interface RegistryIndex {
  $schema: string;
  updated: string;
  /** External sources that can enrich the index */
  sources?: RegistrySource[];
  /** Curated skill list — just metadata + links */
  skills: SkillManifest[];
}

export interface SkillDetail extends SkillManifest {
  /** Full content of the SKILL.md */
  readme: string;
}
