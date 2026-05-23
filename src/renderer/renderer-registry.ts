import type { Renderer } from './renderer.interface.js';
import type { FormatType } from '../core/types.js';
import { TransSkillError } from '../core/errors.js';

const rendererRegistry = new Map<FormatType, Renderer>();

export function registerRenderer(renderer: Renderer): void {
  rendererRegistry.set(renderer.format, renderer);
}

export function getRenderer(format: FormatType): Renderer {
  const renderer = rendererRegistry.get(format);
  if (!renderer) {
    throw new TransSkillError(
      `Unsupported output format: ${format}`,
      'UNSUPPORTED_OUTPUT_FORMAT',
    );
  }
  return renderer;
}

export function getRegisteredRenderers(): Renderer[] {
  return Array.from(rendererRegistry.values());
}
