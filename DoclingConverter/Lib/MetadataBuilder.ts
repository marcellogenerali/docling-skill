/**
 * MetadataBuilder.ts - Minimal YAML frontmatter generation
 */

import { createHash } from 'crypto';
import { readFileSync, statSync } from 'fs';
import { basename, extname } from 'path';
import type { DoclingOutput } from './Types.ts';
import { SKILL_VERSION } from './Types.ts';

// ============================================================================
// Public Functions
// ============================================================================

export interface MetadataParams {
  inputPath: string;
  doclingOutput: DoclingOutput;
  doclingVersion: string;
  imageCount: number;
  markdownContent: string;
  pipelineUsed: 'standard' | 'vlm' | 'ocr';
}

/**
 * Generate minimal YAML frontmatter
 */
export function generateFrontmatter(params: MetadataParams): string {
  const {
    inputPath,
    doclingOutput,
    doclingVersion,
    imageCount,
    markdownContent,
  } = params;

  const stats = statSync(inputPath);
  const wordCount = markdownContent.split(/\s+/).filter(w => w.length > 0).length;
  const pageCount = Object.keys(doclingOutput.pages || {}).length;

  const metadata = {
    title: extractTitle(doclingOutput),
    source_file: basename(inputPath),
    source_format: extname(inputPath).toLowerCase().replace('.', ''),
    source_hash: computeFileHash(inputPath),
    source_size_bytes: stats.size,
    converted_at: new Date().toISOString(),
    converter: 'docling',
    converter_version: doclingVersion,
    skill_version: SKILL_VERSION,
    page_count: pageCount || 1,
    word_count: wordCount,
    image_count: imageCount,
  };

  const lines = ['---'];
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'string') {
      lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push('---');

  return lines.join('\n');
}

// ============================================================================
// Helpers
// ============================================================================

function computeFileHash(filePath: string): string {
  const content = readFileSync(filePath);
  const hash = createHash('sha256').update(content).digest('hex');
  return `sha256:${hash.substring(0, 16)}`;
}

function extractTitle(doclingOutput: DoclingOutput): string {
  if (doclingOutput.origin?.filename) {
    const name = doclingOutput.origin.filename;
    return name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  }
  return 'Untitled Document';
}
