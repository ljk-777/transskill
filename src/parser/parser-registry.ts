import type { Parser } from './parser.interface.js';
import type { FormatType } from '../core/types.js';

const parserRegistry = new Map<FormatType, Parser>();

/**
 * Register a parser for a specific format.
 */
export function registerParser(parser: Parser): void {
  parserRegistry.set(parser.format, parser);
}

/**
 * Get a parser by format type.
 * Throws if the format is not supported.
 */
export function getParser(format: FormatType): Parser {
  const parser = parserRegistry.get(format);
  if (!parser) {
    throw new Error(`Unsupported format: ${format}`);
  }
  return parser;
}

/**
 * Try to detect the format from content and/or file path.
 * Returns null if no parser can handle it.
 */
export function detectFormat(content: string, filePath?: string): FormatType | null {
  for (const [, parser] of parserRegistry) {
    if (parser.detect(content, filePath)) {
      return parser.format;
    }
  }
  return null;
}

/**
 * List all registered format types.
 */
export function getRegisteredFormats(): FormatType[] {
  return Array.from(parserRegistry.keys());
}

/**
 * Check if a format is supported.
 */
export function isFormatSupported(format: string): boolean {
  return parserRegistry.has(format as FormatType);
}
