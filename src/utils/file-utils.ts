import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { TransSkillError } from '../core/errors.js';

/** Read file content as string */
export function readInput(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch (err) {
    throw new TransSkillError(
      `Failed to read file: ${filePath}`,
      'FILE_NOT_FOUND',
      { path: filePath, originalError: String(err) },
    );
  }
}

/** Write string content to file, creating parent directories if needed */
export function writeOutput(filePath: string, content: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, content, 'utf-8');
}

/** Ensure a directory exists */
export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/** Get a human-readable relative path for display */
export function displayPath(absPath: string, cwd: string = process.cwd()): string {
  try {
    const rel = relative(cwd, absPath);
    return rel.startsWith('..') ? absPath : rel;
  } catch {
    return absPath;
  }
}
