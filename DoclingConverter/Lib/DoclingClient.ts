/**
 * DoclingClient.ts - Wrapper for the Docling CLI
 *
 * Handles document conversion using the docling command-line tool.
 */

import { execa, type ExecaError } from 'execa';
import { existsSync, mkdtempSync, rmSync, readdirSync, readFileSync } from 'fs';
import { tmpdir, homedir } from 'os';
import { join, extname } from 'path';
import type { ConversionOptions, DoclingOutput, SupportedFormat } from './Types.ts';

// ============================================================================
// Configuration
// ============================================================================

const DOCLING_TIMEOUT_MS = 300000; // 5 minutes per document

// Possible locations for docling CLI (checked in order)
const DOCLING_PATHS = [
  'docling', // System PATH
  join(homedir(), 'Library', 'Python', '3.9', 'bin', 'docling'), // macOS user pip3
  join(homedir(), 'Library', 'Python', '3.10', 'bin', 'docling'),
  join(homedir(), 'Library', 'Python', '3.11', 'bin', 'docling'),
  join(homedir(), 'Library', 'Python', '3.12', 'bin', 'docling'),
  join(homedir(), '.local', 'bin', 'docling'), // Linux user pip
  '/usr/local/bin/docling', // Homebrew
];

// Cached docling path once found
let cachedDoclingPath: string | null = null;

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Find the docling CLI path
 */
export async function findDoclingPath(): Promise<string | null> {
  if (cachedDoclingPath) {
    return cachedDoclingPath;
  }

  for (const path of DOCLING_PATHS) {
    try {
      await execa(path, ['--version'], { timeout: 5000 });
      cachedDoclingPath = path;
      return path;
    } catch {
      // Try next path
    }
  }

  return null;
}

/**
 * Check if docling CLI is installed and available
 */
export async function checkDoclingInstalled(): Promise<boolean> {
  const path = await findDoclingPath();
  return path !== null;
}

/**
 * Get the installed docling version
 */
export async function getDoclingVersion(): Promise<string> {
  const doclingPath = await findDoclingPath();
  if (!doclingPath) {
    return 'unknown';
  }

  try {
    const { stdout, stderr } = await execa(doclingPath, ['--version'], { timeout: 10000 });
    // Parse version from output like "Docling version: 2.67.0"
    const output = stdout || stderr;
    const match = output.match(/Docling\s+version[:\s]+([\d.]+)/i);
    return match ? match[1] : 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Convert a document using the docling CLI
 */
export async function convert(
  inputPath: string,
  options: ConversionOptions = { inputPath }
): Promise<DoclingOutput> {
  // Validate input file exists
  if (!existsSync(inputPath)) {
    throw new DoclingError('FILE_NOT_FOUND', `Input file not found: ${inputPath}`);
  }

  // Validate format
  const format = getFormat(inputPath);
  if (!isSupported(format)) {
    throw new DoclingError(
      'UNSUPPORTED_FORMAT',
      `Unsupported format: ${format}. Supported: ${SUPPORTED_FORMATS_LIST.join(', ')}`
    );
  }

  // Check docling is installed and get path
  const doclingPath = await findDoclingPath();
  if (!doclingPath) {
    throw new DoclingError(
      'DOCLING_NOT_INSTALLED',
      'Docling CLI not found. Install with: pip3 install "docling>=2.67.0"'
    );
  }

  // Create temporary output directory
  const tempDir = mkdtempSync(join(tmpdir(), 'docling-'));

  try {
    // Build CLI arguments
    const args = buildCliArgs(inputPath, tempDir, options);

    // Run docling
    await execa(doclingPath, args, {
      timeout: DOCLING_TIMEOUT_MS,
      env: { ...process.env },
    });

    // Find and parse the JSON output
    const output = findAndParseOutput(tempDir);

    // Store temp directory path for later cleanup
    output._tempDir = tempDir;

    return output;
  } catch (error) {
    // Clean up temp directory on error
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    if (isExecaError(error)) {
      throw new DoclingError(
        'DOCLING_FAILED',
        `Docling conversion failed: ${error.stderr || error.message}`,
        { exitCode: error.exitCode, stderr: error.stderr }
      );
    }
    throw error;
  }
}

/**
 * Clean up temporary files from a conversion
 */
export function cleanupTempFiles(output: DoclingOutput): void {
  if (output._tempDir) {
    try {
      rmSync(output._tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Get the file format from path
 */
export function getFormat(filePath: string): string {
  return extname(filePath).toLowerCase().replace('.', '');
}

/**
 * Check if a format is supported
 */
export function isSupported(format: string): format is SupportedFormat {
  return SUPPORTED_FORMATS_LIST.includes(format as SupportedFormat);
}

// ============================================================================
// Private Functions
// ============================================================================

const SUPPORTED_FORMATS_LIST: readonly string[] = [
  'pdf', 'docx', 'pptx', 'xlsx', 'html', 'htm', 'md',
  'png', 'jpg', 'jpeg', 'tiff', 'wav', 'mp3', 'vtt'
];

function buildCliArgs(
  inputPath: string,
  outputDir: string,
  options: ConversionOptions
): string[] {
  const args: string[] = [inputPath];

  // Output format - always JSON for programmatic access
  args.push('--to', 'json');

  // Output directory
  args.push('--output', outputDir);

  // Export images as embedded base64 data URIs
  args.push('--image-export-mode', 'embedded');

  // OCR options
  if (options.ocr) {
    args.push('--ocr');
    if (options.sourceLanguage) {
      args.push('--ocr-lang', options.sourceLanguage);
    }
  }

  // VLM pipeline
  if (options.vlm) {
    args.push('--pipeline', 'vlm');
    args.push('--vlm-model', 'granite_docling');
  }

  // Enable table extraction
  args.push('--tables');

  // Verbose for debugging
  args.push('-v');

  return args;
}

function findAndParseOutput(tempDir: string): DoclingOutput {
  // Look for JSON output file
  const files = readdirSync(tempDir);
  const jsonFile = files.find(f => f.endsWith('.json'));

  if (!jsonFile) {
    throw new DoclingError(
      'DOCLING_FAILED',
      'No JSON output found from docling conversion'
    );
  }

  const jsonPath = join(tempDir, jsonFile);
  const content = readFileSync(jsonPath, 'utf-8');

  try {
    const output = JSON.parse(content) as DoclingOutput;

    // Enhance with image paths if images directory exists
    const imagesDir = join(tempDir, 'images');
    if (existsSync(imagesDir)) {
      const imageFiles = readdirSync(imagesDir);
      // Update picture references to point to actual files
      if (output.pictures) {
        output.pictures = output.pictures.map((pic, index) => {
          const imageFile = imageFiles[index];
          if (imageFile) {
            return {
              ...pic,
              image: {
                ...pic.image,
                uri: join(imagesDir, imageFile),
                size: pic.image?.size || { width: 0, height: 0 },
              },
            };
          }
          return pic;
        });
      }
    }

    return output;
  } catch (error) {
    throw new DoclingError(
      'DOCLING_FAILED',
      `Failed to parse docling output: ${(error as Error).message}`
    );
  }
}

function isExecaError(error: unknown): error is ExecaError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'exitCode' in error &&
    'stderr' in error
  );
}

// ============================================================================
// Error Class
// ============================================================================

export class DoclingError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'DoclingError';
    this.code = code;
    this.details = details;
  }
}

// ============================================================================
// Exports
// ============================================================================

export type { DoclingOutput };
