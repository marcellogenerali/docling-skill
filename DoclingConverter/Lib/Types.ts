/**
 * Types.ts - Shared TypeScript interfaces for DoclingConverter
 */

// ============================================================================
// Conversion Options
// ============================================================================

export interface ConversionOptions {
  inputPath: string;
  outputPath?: string;
  ocr?: boolean;
  vlm?: boolean;
  sourceLanguage?: string;
  batch?: boolean;
}

export interface BatchOptions extends ConversionOptions {
  inputDirectory: string;
  filePattern?: string;
  resume?: boolean;
}

// ============================================================================
// Docling Output
// ============================================================================

export interface DoclingOutput {
  schema_name?: string;
  version?: string;
  name: string;
  origin: {
    filename: string;
    mimetype: string;
    binary_hash: string | number;
    uri?: string;
  };
  furniture: DoclingNode;
  body: DoclingNode;
  groups?: DoclingGroup[];
  texts?: DoclingText[];
  pictures?: DoclingPicture[];
  tables?: DoclingTable[];
  key_value_items?: unknown[];
  form_items?: unknown[];
  pages?: Record<string, DoclingPageMeta>;
  /** Internal: temp directory path for cleanup */
  _tempDir?: string;
}

export interface DoclingNode {
  self_ref: string;
  children?: { $ref: string }[];
  content_layer?: string;
  name?: string;
  label: string;
}

export interface DoclingGroup {
  self_ref: string;
  parent?: { $ref: string };
  children?: { $ref: string }[];
  label: string;
  name?: string;
}

export interface DoclingText {
  self_ref: string;
  parent?: { $ref: string };
  children?: { $ref: string }[];
  label: string;
  prov?: DoclingProvenance[];
  text: string;
  orig?: string;
  level?: number;
  marker?: string;
  enumerated?: boolean;
  code_language?: string;
}

export interface DoclingPage {
  page_no: number;
  size: { width: number; height: number };
}

export interface DoclingPageMeta {
  size: { width: number; height: number };
  page_no: number;
}

export interface DoclingProvenance {
  page_no: number;
  bbox: { l: number; t: number; r: number; b: number };
  charspan?: [number, number];
}

export interface DoclingPicture {
  self_ref: string;
  parent?: { $ref: string };
  children?: { $ref: string }[];
  content_layer?: string;
  label: string;
  prov?: DoclingProvenance[];
  captions?: unknown[];
  references?: unknown[];
  footnotes?: unknown[];
  image?: {
    mimetype?: string;
    dpi?: number;
    uri: string;
    size: { width: number; height: number };
  };
  caption_refs?: { $ref: string }[];
}

export interface DoclingTable {
  self_ref: string;
  parent?: { $ref: string };
  label: string;
  prov: DoclingProvenance[];
  data: {
    table_cells: DoclingTableCell[];
    num_rows: number;
    num_cols: number;
  };
}

export interface DoclingTableCell {
  row_span: number;
  col_span: number;
  start_row_offset_idx: number;
  end_row_offset_idx: number;
  start_col_offset_idx: number;
  end_col_offset_idx: number;
  text: string;
  column_header: boolean;
  row_header: boolean;
}

// ============================================================================
// Image Processing
// ============================================================================

export interface ImageModelConfig {
  provider: 'ollama' | 'anthropic' | 'none';
  model: string;
  cost: number;
}

export interface CompressedImage {
  originalPath: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  width: number;
  height: number;
  format: 'jpeg' | 'png';
  base64: string;
  dataUri: string;
  compressionRatio: number;
}

export interface ProcessedImage extends CompressedImage {
  index: number;
  description: string;
  descriptionGenerated: boolean;
  descriptionModel: string | null;
}

export interface ImageContext {
  documentTitle: string;
  headingPath: string[];
  surroundingText: string;
  pageNumber: number;
}

// ============================================================================
// Translation
// ============================================================================

export interface TranslationResult {
  content: string;
  sourceLanguage: string;
  targetLanguage: string;
  translated: boolean;
  model: string | null;
  chunksTranslated: number;
}

// ============================================================================
// Metadata
// ============================================================================

export interface DocumentMetadata {
  // Document Identity
  title: string;
  source_file: string;
  source_path: string;
  source_format: string;
  source_hash: string;
  source_size_bytes: number;
  source_language: string;

  // Processing Info
  converted_at: string;
  converter: string;
  converter_version: string;
  skill_version: string;
  pipeline_used: 'standard' | 'vlm' | 'ocr' | 'asr';
  ocr_applied: boolean;
  translated_to: string | null;
  translation_model: string | null;

  // LLM Processing
  image_description_model: string;
  image_descriptions_generated: number;
  image_descriptions_skipped: number;
  translation_required: boolean;

  // Content Metrics
  page_count: number;
  section_count: number;
  paragraph_count: number;
  word_count: number;
  char_count: number;
  sentence_count: number;

  // Structural Elements
  heading_hierarchy: {
    h1: number;
    h2: number;
    h3: number;
    h4: number;
    h5: number;
    h6: number;
  };
  has_tables: boolean;
  table_count: number;
  has_code_blocks: boolean;
  code_block_count: number;
  has_lists: boolean;
  list_count: number;
  has_images: boolean;
  image_count: number;

  // Image Summary
  images: ImageMetadata[];

  // Semantic Hints
  document_type: string;
  primary_topics: string[];
  estimated_reading_time_minutes: number;
  complexity_level: 'simple' | 'moderate' | 'technical' | 'academic';

  // Chunking Recommendations
  recommended_chunk_size: number;
  natural_break_points: number;
  avg_paragraph_length: number;
}

export interface ImageMetadata {
  index: number;
  original_size_kb: number;
  compressed_size_kb: number;
  dimensions: string;
  compression_ratio: number;
  description_generated: boolean;
}

// ============================================================================
// Batch Processing
// ============================================================================

export type FileStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface BatchFileEntry {
  path: string;
  hash: string;
  status: FileStatus;
  error?: string;
  outputPath?: string;
  processingTime?: number;
}

export interface BatchManifest {
  jobId: string;
  createdAt: string;
  updatedAt: string;
  inputDirectory: string;
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  files: BatchFileEntry[];
}

// ============================================================================
// Conversion Result
// ============================================================================

export interface ConversionResult {
  success: boolean;
  inputPath: string;
  outputPath: string;
  sourceFormat: string;
  sourceLanguage: string;
  targetLanguage: string;
  pageCount: number;
  imageCount: number;
  imagesDescribed: number;
  imagesSkipped: number;
  translated: boolean;
  translationModel: string | null;
  imageDescriptionModel: string;
  outputSizeBytes: number;
  compressionRatio: number;
  conversionTimeMs: number;
  imageProcessingTimeMs: number;
  translationTimeMs: number;
  totalTimeMs: number;
  error?: string;
  metadata: DocumentMetadata;
}

// ============================================================================
// Error Types
// ============================================================================

export interface ConversionError {
  code: string;
  message: string;
  details?: unknown;
  recoverable: boolean;
}

export const ErrorCodes = {
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  DOCLING_NOT_INSTALLED: 'DOCLING_NOT_INSTALLED',
  DOCLING_FAILED: 'DOCLING_FAILED',
  IMAGE_PROCESSING_FAILED: 'IMAGE_PROCESSING_FAILED',
  TRANSLATION_FAILED: 'TRANSLATION_FAILED',
  OUTPUT_WRITE_FAILED: 'OUTPUT_WRITE_FAILED',
} as const;

// ============================================================================
// Constants
// ============================================================================

export const SUPPORTED_FORMATS = [
  'pdf', 'docx', 'pptx', 'xlsx', 'html', 'htm', 'md',
  'png', 'jpg', 'jpeg', 'tiff', 'wav', 'mp3', 'vtt'
] as const;

export type SupportedFormat = typeof SUPPORTED_FORMATS[number];

export const SKILL_VERSION = '2.0.0';
