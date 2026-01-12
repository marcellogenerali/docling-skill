/**
 * MetadataBuilder.ts - YAML frontmatter generation
 */

import { createHash } from 'crypto';
import { readFileSync, statSync } from 'fs';
import { basename, extname } from 'path';
import { stringify as yamlStringify } from 'yaml';
import type {
  DocumentMetadata,
  ImageMetadata,
  ProcessedImage,
  DoclingOutput,
  TranslationResult,
  SKILL_VERSION,
} from './Types.ts';

// ============================================================================
// Configuration
// ============================================================================

const WORDS_PER_MINUTE = 250; // Average reading speed

// ============================================================================
// Public Functions
// ============================================================================

export interface MetadataParams {
  inputPath: string;
  doclingOutput: DoclingOutput;
  doclingVersion: string;
  processedImages: ProcessedImage[];
  translationResult: TranslationResult;
  markdownContent: string;
  pipelineUsed: 'standard' | 'vlm' | 'ocr' | 'asr';
  ocrApplied: boolean;
  imageDescriptionModel: string;
}

/**
 * Build complete document metadata
 */
export function buildMetadata(params: MetadataParams): DocumentMetadata {
  const {
    inputPath,
    doclingOutput,
    doclingVersion,
    processedImages,
    translationResult,
    markdownContent,
    pipelineUsed,
    ocrApplied,
    imageDescriptionModel,
  } = params;

  const stats = statSync(inputPath);
  const contentMetrics = computeContentMetrics(markdownContent);
  const structuralElements = analyzeStructuralElements(markdownContent);
  const headingHierarchy = analyzeHeadingHierarchy(markdownContent);

  return {
    // Document Identity
    title: extractTitle(doclingOutput, markdownContent),
    source_file: basename(inputPath),
    source_path: inputPath,
    source_format: extname(inputPath).toLowerCase().replace('.', ''),
    source_hash: computeFileHash(inputPath),
    source_size_bytes: stats.size,
    source_language: translationResult.sourceLanguage,

    // Processing Info
    converted_at: new Date().toISOString(),
    converter: 'docling',
    converter_version: doclingVersion,
    skill_version: '2.0.0',
    pipeline_used: pipelineUsed,
    ocr_applied: ocrApplied,
    translated_to: translationResult.translated ? 'en' : null,
    translation_model: translationResult.model,

    // LLM Processing
    image_description_model: imageDescriptionModel,
    image_descriptions_generated: processedImages.filter(img => img.descriptionGenerated).length,
    image_descriptions_skipped: processedImages.filter(img => !img.descriptionGenerated).length,
    translation_required: translationResult.sourceLanguage !== 'en',

    // Content Metrics
    ...contentMetrics,

    // Structural Elements
    heading_hierarchy: headingHierarchy,
    ...structuralElements,

    // Image Summary
    images: processedImages.map(img => ({
      index: img.index,
      original_size_kb: Math.round(img.originalSizeBytes / 1024),
      compressed_size_kb: Math.round(img.compressedSizeBytes / 1024),
      dimensions: `${img.width}x${img.height}`,
      compression_ratio: Math.round(img.compressionRatio * 100) / 100,
      description_generated: img.descriptionGenerated,
    })),

    // Semantic Hints
    document_type: estimateDocumentType(markdownContent, extname(inputPath)),
    primary_topics: extractTopics(markdownContent),
    estimated_reading_time_minutes: Math.ceil(contentMetrics.word_count / WORDS_PER_MINUTE),
    complexity_level: estimateComplexity(markdownContent),

    // Chunking Recommendations
    recommended_chunk_size: 512,
    natural_break_points: contentMetrics.paragraph_count,
    avg_paragraph_length: contentMetrics.paragraph_count > 0
      ? Math.round(contentMetrics.word_count / contentMetrics.paragraph_count)
      : 0,
  };
}

/**
 * Generate YAML frontmatter string
 */
export function generateFrontmatter(metadata: DocumentMetadata): string {
  // Create structured YAML with comments
  const sections = {
    '# === DOCUMENT IDENTITY ===': null,
    title: metadata.title,
    source_file: metadata.source_file,
    source_path: metadata.source_path,
    source_format: metadata.source_format,
    source_hash: metadata.source_hash,
    source_size_bytes: metadata.source_size_bytes,
    source_language: metadata.source_language,

    '\n# === PROCESSING INFO ===': null,
    converted_at: metadata.converted_at,
    converter: metadata.converter,
    converter_version: metadata.converter_version,
    skill_version: metadata.skill_version,
    pipeline_used: metadata.pipeline_used,
    ocr_applied: metadata.ocr_applied,
    translated_to: metadata.translated_to,
    translation_model: metadata.translation_model,

    '\n# === LLM PROCESSING ===': null,
    image_description_model: metadata.image_description_model,
    image_descriptions_generated: metadata.image_descriptions_generated,
    image_descriptions_skipped: metadata.image_descriptions_skipped,
    translation_required: metadata.translation_required,

    '\n# === CONTENT METRICS ===': null,
    page_count: metadata.page_count,
    section_count: metadata.section_count,
    paragraph_count: metadata.paragraph_count,
    word_count: metadata.word_count,
    char_count: metadata.char_count,
    sentence_count: metadata.sentence_count,

    '\n# === STRUCTURAL ELEMENTS ===': null,
    heading_hierarchy: metadata.heading_hierarchy,
    has_tables: metadata.has_tables,
    table_count: metadata.table_count,
    has_code_blocks: metadata.has_code_blocks,
    code_block_count: metadata.code_block_count,
    has_lists: metadata.has_lists,
    list_count: metadata.list_count,
    has_images: metadata.has_images,
    image_count: metadata.image_count,

    '\n# === IMAGE SUMMARY ===': null,
    images: metadata.images,

    '\n# === SEMANTIC HINTS ===': null,
    document_type: metadata.document_type,
    primary_topics: metadata.primary_topics,
    estimated_reading_time_minutes: metadata.estimated_reading_time_minutes,
    complexity_level: metadata.complexity_level,

    '\n# === CHUNKING RECOMMENDATIONS ===': null,
    recommended_chunk_size: metadata.recommended_chunk_size,
    natural_break_points: metadata.natural_break_points,
    avg_paragraph_length: metadata.avg_paragraph_length,
  };

  // Build YAML with comment sections
  let yaml = '';
  for (const [key, value] of Object.entries(sections)) {
    if (key.startsWith('#') || key.startsWith('\n#')) {
      yaml += key + '\n';
    } else if (value !== null) {
      yaml += yamlStringify({ [key]: value });
    }
  }

  return `---\n${yaml}---`;
}

// ============================================================================
// Content Analysis
// ============================================================================

function computeContentMetrics(markdown: string): {
  page_count: number;
  section_count: number;
  paragraph_count: number;
  word_count: number;
  char_count: number;
  sentence_count: number;
} {
  // Remove frontmatter if present
  const content = markdown.replace(/^---[\s\S]*?---\n*/, '');

  const words = content.split(/\s+/).filter(w => w.length > 0);
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
  const sections = (content.match(/^#{1,6}\s+/gm) || []).length;

  return {
    page_count: Math.ceil(words.length / 500), // Estimate pages
    section_count: sections,
    paragraph_count: paragraphs.length,
    word_count: words.length,
    char_count: content.length,
    sentence_count: sentences.length,
  };
}

function analyzeHeadingHierarchy(markdown: string): {
  h1: number;
  h2: number;
  h3: number;
  h4: number;
  h5: number;
  h6: number;
} {
  return {
    h1: (markdown.match(/^#\s+/gm) || []).length,
    h2: (markdown.match(/^##\s+/gm) || []).length,
    h3: (markdown.match(/^###\s+/gm) || []).length,
    h4: (markdown.match(/^####\s+/gm) || []).length,
    h5: (markdown.match(/^#####\s+/gm) || []).length,
    h6: (markdown.match(/^######\s+/gm) || []).length,
  };
}

function analyzeStructuralElements(markdown: string): {
  has_tables: boolean;
  table_count: number;
  has_code_blocks: boolean;
  code_block_count: number;
  has_lists: boolean;
  list_count: number;
  has_images: boolean;
  image_count: number;
} {
  const tables = (markdown.match(/\|.*\|.*\n\|[-:| ]+\|/g) || []).length;
  const codeBlocks = (markdown.match(/```[\s\S]*?```/g) || []).length;
  const lists = (markdown.match(/^[\s]*[-*+]\s+/gm) || []).length +
                (markdown.match(/^[\s]*\d+\.\s+/gm) || []).length;
  const images = (markdown.match(/!\[.*?\]\(.*?\)/g) || []).length;

  return {
    has_tables: tables > 0,
    table_count: tables,
    has_code_blocks: codeBlocks > 0,
    code_block_count: codeBlocks,
    has_lists: lists > 0,
    list_count: lists,
    has_images: images > 0,
    image_count: images,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function computeFileHash(filePath: string): string {
  const content = readFileSync(filePath);
  const hash = createHash('sha256').update(content).digest('hex');
  return `sha256:${hash.substring(0, 16)}`;
}

function extractTitle(doclingOutput: DoclingOutput, markdown: string): string {
  // Try to get title from Docling output
  if (doclingOutput.origin?.filename) {
    const name = doclingOutput.origin.filename;
    return name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  }

  // Try to extract from first heading
  const headingMatch = markdown.match(/^#\s+(.+)$/m);
  if (headingMatch) {
    return headingMatch[1].trim();
  }

  return 'Untitled Document';
}

function estimateDocumentType(
  markdown: string,
  extension: string
): string {
  const ext = extension.toLowerCase();

  if (ext === '.pptx' || ext === '.ppt') return 'presentation';
  if (ext === '.xlsx' || ext === '.xls') return 'spreadsheet';

  // Analyze content patterns
  const hasAbstract = /\babstract\b/i.test(markdown);
  const hasReferences = /\breferences\b|\bbibliography\b/i.test(markdown);
  const hasMethods = /\bmethods?\b|\bmethodology\b/i.test(markdown);

  if (hasAbstract && hasReferences) return 'academic_paper';
  if (hasMethods) return 'technical_report';

  const codeBlockCount = (markdown.match(/```/g) || []).length / 2;
  if (codeBlockCount > 5) return 'technical_documentation';

  return 'article';
}

function extractTopics(markdown: string): string[] {
  // Extract from headings
  const headings = markdown.match(/^#{1,3}\s+(.+)$/gm) || [];
  const topics = headings
    .map(h => h.replace(/^#+\s+/, '').toLowerCase())
    .filter(h => h.length > 3 && h.length < 50)
    .slice(0, 5);

  return [...new Set(topics)];
}

function estimateComplexity(
  markdown: string
): 'simple' | 'moderate' | 'technical' | 'academic' {
  const metrics = computeContentMetrics(markdown);
  const avgSentenceLength = metrics.word_count / Math.max(metrics.sentence_count, 1);
  const hasCode = (markdown.match(/```/g) || []).length > 0;
  const hasMath = /\$.*\$|\\\[|\\\(/.test(markdown);
  const hasCitations = /\[\d+\]|\(\w+,?\s*\d{4}\)/.test(markdown);

  if (hasMath || hasCitations) return 'academic';
  if (hasCode || avgSentenceLength > 25) return 'technical';
  if (avgSentenceLength > 18) return 'moderate';
  return 'simple';
}
