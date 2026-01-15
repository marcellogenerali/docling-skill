/**
 * Types.ts - Minimal types for DoclingConverter
 */

// ============================================================================
// Conversion Options
// ============================================================================

export interface ConversionOptions {
  inputPath: string;
  outputPath?: string;
  ocr?: boolean;
  vlm?: boolean;
  assetsDir?: string;        // Custom assets directory (default: {name}-images/)
}

// ============================================================================
// Docling Output (from JSON)
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
  pages?: Record<string, DoclingPageMeta>;
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
  hyperlink?: string;
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
  label: string;
  prov?: DoclingProvenance[];
  image?: {
    mimetype?: string;
    dpi?: number;
    uri: string;
    size: { width: number; height: number };
  };
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
// Image Types
// ============================================================================

export interface ExternalImage {
  index: number;
  pageNumber: number;    // Page this image appears on
  filename: string;      // e.g., "image-001.png"
  relativePath: string;  // e.g., "./doc-images/page-001/image-001.png"
  absolutePath: string;  // Full path on disk
  width: number;
  height: number;
  mimeType: string;
}

// ============================================================================
// Conversion Result
// ============================================================================

export interface ConversionResult {
  success: boolean;
  inputPath: string;
  outputPath: string;
  sourceFormat: string;
  pageCount: number;
  imageCount: number;
  outputSizeBytes: number;
  conversionTimeMs: number;
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

export const SUPPORTED_FORMATS = [
  'pdf', 'docx', 'xlsx', 'html', 'htm', 'md',
  'png', 'jpg', 'jpeg', 'tiff'
] as const;

export type SupportedFormat = typeof SUPPORTED_FORMATS[number];

export const SKILL_VERSION = '5.0.0';
