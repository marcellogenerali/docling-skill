#!/usr/bin/env bun
/**
 * Convert.ts - Document Conversion Tool
 *
 * Converts documents to AI-embedding-ready markdown using Docling.
 *
 * Usage:
 *   bun run Convert.ts <file_path> [options]
 *
 * Options:
 *   --output, -o <path>   Custom output path (default: same directory)
 *   --ocr                 Force OCR processing
 *   --vlm                 Use Vision Language Model pipeline
 *   --lang <code>         Source language hint (e.g., "de", "fr")
 *   --batch               Process directory of files
 *   --help, -h            Show help
 *
 * Examples:
 *   bun run Convert.ts document.pdf
 *   bun run Convert.ts report.pdf --output /output/report.md
 *   bun run Convert.ts scanned.pdf --ocr --lang de
 *   bun run Convert.ts --batch /docs/folder
 */

import { parseArgs } from 'util';
import { existsSync, writeFileSync, readdirSync, statSync, mkdirSync, readFileSync } from 'fs';
import { resolve, dirname, basename, extname, join } from 'path';
import { createHash } from 'crypto';

import {
  convert as doclingConvert,
  checkDoclingInstalled,
  getDoclingVersion,
  getFormat,
  isSupported,
  cleanupTempFiles,
  DoclingError,
} from '../Lib/DoclingClient.ts';
import { processImagesFromDataUri } from '../Lib/ImageProcessor.ts';
import {
  selectImageModel,
  describeImages,
  resetModelCache,
} from '../Lib/DescriptionGenerator.ts';
import { detectLanguage, translate, needsTranslation } from '../Lib/Translator.ts';
import { buildMetadata, generateFrontmatter } from '../Lib/MetadataBuilder.ts';
import type {
  ConversionOptions,
  ConversionResult,
  DoclingOutput,
  ProcessedImage,
  ImageContext,
  BatchManifest,
  BatchFileEntry,
  SUPPORTED_FORMATS,
} from '../Lib/Types.ts';

// ============================================================================
// CLI Interface
// ============================================================================

const HELP_TEXT = `
DoclingConverter - Convert documents to AI-embedding-ready markdown

USAGE:
  bun run Convert.ts <file_path> [options]
  bun run Convert.ts --batch <directory> [options]

OPTIONS:
  --output, -o <path>   Custom output path (default: same directory as input)
  --ocr                 Force OCR processing for scanned documents
  --vlm                 Use Vision Language Model pipeline for complex layouts
  --lang <code>         Source language hint (ISO 639-1: en, de, fr, es, etc.)
  --batch               Process all supported files in a directory
  --resume              Resume interrupted batch job
  --help, -h            Show this help message

EXAMPLES:
  bun run Convert.ts report.pdf
  bun run Convert.ts document.docx --output /output/doc.md
  bun run Convert.ts scanned.pdf --ocr --lang de
  bun run Convert.ts presentation.pptx --vlm
  bun run Convert.ts --batch /docs/pdfs/
  bun run Convert.ts --batch /docs/pdfs/ --resume

SUPPORTED FORMATS:
  PDF, DOCX, PPTX, XLSX, HTML, Markdown, Images (PNG, JPG, TIFF), Audio (WAV, MP3), VTT
`;

function main(): void {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      output: { type: 'string', short: 'o' },
      ocr: { type: 'boolean', default: false },
      vlm: { type: 'boolean', default: false },
      lang: { type: 'string' },
      batch: { type: 'boolean', default: false },
      resume: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
    allowPositionals: true,
  });

  if (values.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const inputPath = positionals[0];

  if (!inputPath) {
    console.error('Error: No input file or directory specified');
    console.log('Use --help for usage information');
    process.exit(1);
  }

  // Run async main
  runConversion(inputPath, {
    inputPath,
    outputPath: values.output,
    ocr: values.ocr,
    vlm: values.vlm,
    sourceLanguage: values.lang,
    batch: values.batch,
  }, values.resume).catch(error => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
}

// ============================================================================
// Main Conversion Logic
// ============================================================================

async function runConversion(
  inputPath: string,
  options: ConversionOptions,
  resume: boolean = false
): Promise<void> {
  const startTime = Date.now();

  // Handle batch mode
  if (options.batch) {
    await runBatchConversion(inputPath, options, resume);
    return;
  }

  // Single file conversion
  const result = await convertSingleFile(inputPath, options);

  // Print result
  printResult(result, Date.now() - startTime);
}

async function convertSingleFile(
  inputPath: string,
  options: ConversionOptions
): Promise<ConversionResult> {
  const absolutePath = resolve(inputPath);
  const startTime = Date.now();

  // ========== STEP 1: VALIDATE ==========
  if (!existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const format = getFormat(absolutePath);
  if (!isSupported(format)) {
    throw new Error(`Unsupported format: ${format}`);
  }

  console.log(`\n  Converting: ${basename(absolutePath)}`);

  // ========== STEP 2: DETECT MODELS ==========
  console.log('  Detecting available models...');
  const imageModelConfig = await selectImageModel();
  console.log(`    Image model: ${imageModelConfig.model}`);

  // ========== STEP 3: CONVERT WITH DOCLING ==========
  console.log('  Running Docling conversion...');
  const conversionStart = Date.now();

  const doclingInstalled = await checkDoclingInstalled();
  if (!doclingInstalled) {
    throw new Error('Docling CLI not installed. Run: pip install docling>=2.67.0');
  }

  const doclingVersion = await getDoclingVersion();
  const doclingOutput = await doclingConvert(absolutePath, options);
  const conversionTime = Date.now() - conversionStart;
  console.log(`    Docling completed in ${conversionTime}ms`);

  // ========== STEP 4: EXTRACT & PROCESS IMAGES ==========
  console.log('  Processing images...');
  const imageStart = Date.now();

  const imageDataUris = extractImageDataUris(doclingOutput);
  console.log(`    Found ${imageDataUris.length} images`);
  if (imageDataUris.length > 0) {
    const firstUri = imageDataUris[0].uri;
    console.log(`    First image URI starts with: ${firstUri.substring(0, 50)}...`);
  }
  const compressedImages = await processImagesFromDataUri(imageDataUris);

  // Generate image contexts
  const imageContexts = generateImageContexts(doclingOutput, compressedImages.length);

  // Describe images
  const processedImages = await describeImages(
    compressedImages,
    imageContexts,
    imageModelConfig
  );

  const imageTime = Date.now() - imageStart;
  const describedCount = processedImages.filter(img => img.descriptionGenerated).length;
  console.log(`    Processed ${processedImages.length} images (${describedCount} described) in ${imageTime}ms`);

  // Clean up temp files now that images are processed
  cleanupTempFiles(doclingOutput);

  // ========== STEP 5: DETECT LANGUAGE ==========
  console.log('  Detecting language...');
  const rawMarkdown = doclingOutputToMarkdown(doclingOutput, processedImages);
  const sourceLanguage = await detectLanguage(rawMarkdown, options.sourceLanguage);
  console.log(`    Detected: ${sourceLanguage}`);

  // ========== STEP 6: TRANSLATE (if needed) ==========
  let translatedMarkdown = rawMarkdown;
  let translationResult = {
    content: rawMarkdown,
    sourceLanguage,
    targetLanguage: 'en',
    translated: false,
    model: null as string | null,
    chunksTranslated: 0,
  };

  if (needsTranslation(sourceLanguage)) {
    console.log('  Translating to English...');
    const translationStart = Date.now();
    translationResult = await translate(rawMarkdown, sourceLanguage);
    translatedMarkdown = translationResult.content;
    const translationTime = Date.now() - translationStart;
    console.log(`    Translation completed in ${translationTime}ms`);
  }

  // ========== STEP 7: BUILD METADATA ==========
  console.log('  Building metadata...');
  const pipelineUsed = options.vlm ? 'vlm' : (options.ocr ? 'ocr' : 'standard');
  const metadata = buildMetadata({
    inputPath: absolutePath,
    doclingOutput,
    doclingVersion,
    processedImages,
    translationResult,
    markdownContent: translatedMarkdown,
    pipelineUsed,
    ocrApplied: options.ocr || false,
    imageDescriptionModel: imageModelConfig.model,
  });

  // ========== STEP 8: ASSEMBLE MARKDOWN ==========
  const frontmatter = generateFrontmatter(metadata);
  const finalMarkdown = assembleMarkdown(frontmatter, translatedMarkdown, absolutePath);

  // ========== STEP 9: WRITE OUTPUT ==========
  const outputPath = options.outputPath || generateOutputPath(absolutePath);
  writeFileSync(outputPath, finalMarkdown, 'utf-8');

  const totalTime = Date.now() - startTime;
  const outputStats = statSync(outputPath);

  return {
    success: true,
    inputPath: absolutePath,
    outputPath,
    sourceFormat: format,
    sourceLanguage,
    targetLanguage: 'en',
    pageCount: Object.keys(doclingOutput.pages || {}).length,
    imageCount: processedImages.length,
    imagesDescribed: describedCount,
    imagesSkipped: processedImages.length - describedCount,
    translated: translationResult.translated,
    translationModel: translationResult.model,
    imageDescriptionModel: imageModelConfig.model,
    outputSizeBytes: outputStats.size,
    compressionRatio: 0, // Calculate if needed
    conversionTimeMs: conversionTime,
    imageProcessingTimeMs: imageTime,
    translationTimeMs: translationResult.translated ? totalTime - conversionTime - imageTime : 0,
    totalTimeMs: totalTime,
    metadata,
  };
}

// ============================================================================
// Batch Processing
// ============================================================================

async function runBatchConversion(
  inputDir: string,
  options: ConversionOptions,
  resume: boolean
): Promise<void> {
  const absoluteDir = resolve(inputDir);

  if (!existsSync(absoluteDir) || !statSync(absoluteDir).isDirectory()) {
    throw new Error(`Directory not found: ${absoluteDir}`);
  }

  // Find or create manifest
  const workDir = join(absoluteDir, '.docling-work');
  const manifest = resume
    ? await loadOrCreateManifest(workDir, absoluteDir)
    : await createManifest(workDir, absoluteDir);

  console.log(`\nBatch conversion: ${manifest.totalFiles} files`);

  let completed = 0;
  let failed = 0;

  for (const file of manifest.files) {
    if (file.status === 'completed') {
      completed++;
      continue;
    }

    const fileIndex = manifest.files.indexOf(file) + 1;
    console.log(`\n[${fileIndex}/${manifest.totalFiles}] ${basename(file.path)}`);

    try {
      file.status = 'processing';
      saveManifest(workDir, manifest);

      const result = await convertSingleFile(file.path, {
        ...options,
        batch: false,
      });

      file.status = 'completed';
      file.outputPath = result.outputPath;
      file.processingTime = result.totalTimeMs;
      completed++;
    } catch (error) {
      file.status = 'failed';
      file.error = (error as Error).message;
      failed++;
      console.error(`  Error: ${file.error}`);
    }

    manifest.completedFiles = completed;
    manifest.failedFiles = failed;
    manifest.updatedAt = new Date().toISOString();
    saveManifest(workDir, manifest);
  }

  // Print summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Batch complete: ${completed} succeeded, ${failed} failed`);

  if (failed === 0) {
    // Clean up work directory on success
    const { rmSync } = await import('fs');
    rmSync(workDir, { recursive: true, force: true });
  } else {
    console.log(`Work directory preserved for resume: ${workDir}`);
  }
}

async function createManifest(workDir: string, inputDir: string): Promise<BatchManifest> {
  mkdirSync(workDir, { recursive: true });

  const files = findSupportedFiles(inputDir);

  const manifest: BatchManifest = {
    jobId: createHash('md5').update(Date.now().toString()).digest('hex').substring(0, 8),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    inputDirectory: inputDir,
    totalFiles: files.length,
    completedFiles: 0,
    failedFiles: 0,
    files: files.map(path => ({
      path,
      hash: createHash('md5').update(path).digest('hex').substring(0, 8),
      status: 'pending' as const,
    })),
  };

  saveManifest(workDir, manifest);
  return manifest;
}

async function loadOrCreateManifest(workDir: string, inputDir: string): Promise<BatchManifest> {
  const manifestPath = join(workDir, 'manifest.json');

  if (existsSync(manifestPath)) {
    const content = readFileSync(manifestPath, 'utf-8');
    return JSON.parse(content) as BatchManifest;
  }

  return createManifest(workDir, inputDir);
}

function saveManifest(workDir: string, manifest: BatchManifest): void {
  const manifestPath = join(workDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}

function findSupportedFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    if (entry.startsWith('.')) continue;

    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isFile() && isSupported(getFormat(fullPath))) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

// ============================================================================
// Helper Functions
// ============================================================================

function extractImageDataUris(doclingOutput: DoclingOutput): { uri: string; size?: { width: number; height: number } }[] {
  if (!doclingOutput.pictures) return [];

  return doclingOutput.pictures
    .filter(pic => pic.image?.uri)
    .map(pic => ({
      uri: pic.image!.uri,
      size: pic.image!.size,
    }));
}

function generateImageContexts(
  doclingOutput: DoclingOutput,
  imageCount: number
): ImageContext[] {
  const title = doclingOutput.origin?.filename || 'Document';
  const contexts: ImageContext[] = [];

  for (let i = 0; i < imageCount; i++) {
    const picture = doclingOutput.pictures?.[i];
    const pageNo = picture?.prov?.[0]?.page_no || 1;

    // Find surrounding text elements
    const surroundingText = findSurroundingText(doclingOutput, picture);
    const headingPath = findHeadingPath(doclingOutput, picture);

    contexts.push({
      documentTitle: title.replace(/\.[^/.]+$/, ''),
      headingPath,
      surroundingText,
      pageNumber: pageNo,
    });
  }

  return contexts;
}

function findSurroundingText(doclingOutput: DoclingOutput, _picture: unknown): string {
  if (!doclingOutput.texts) return '';

  // Get text from first few elements
  const texts: string[] = [];
  for (const element of doclingOutput.texts.slice(0, 5)) {
    if (element.text) {
      texts.push(element.text);
    }
  }

  return texts.join(' ').substring(0, 300);
}

function findHeadingPath(doclingOutput: DoclingOutput, _picture: unknown): string[] {
  if (!doclingOutput.texts) return [];

  const headings: string[] = [];
  for (const element of doclingOutput.texts) {
    if (element.label === 'section_header' && element.text) {
      headings.push(element.text);
      if (headings.length >= 3) break;
    }
  }

  return headings;
}

function doclingOutputToMarkdown(
  doclingOutput: DoclingOutput,
  images: ProcessedImage[]
): string {
  const lines: string[] = [];

  // Process text elements
  for (const element of doclingOutput.texts || []) {
    switch (element.label) {
      case 'section_header':
        const level = element.level || 1;
        lines.push(`${'#'.repeat(Math.min(level, 6))} ${element.text || ''}`);
        lines.push('');
        break;

      case 'paragraph':
      case 'text':
        if (element.text) {
          lines.push(element.text);
          lines.push('');
        }
        break;

      case 'list_item':
        const marker = element.enumerated ? `${element.marker || '1.'}` : '-';
        lines.push(`${marker} ${element.text || ''}`);
        break;

      case 'code':
        const lang = element.code_language || '';
        lines.push(`\`\`\`${lang}`);
        lines.push(element.text || '');
        lines.push('```');
        lines.push('');
        break;

      default:
        // Handle other text types
        if (element.text) {
          lines.push(element.text);
          lines.push('');
        }
        break;
    }
  }

  // Add images at the end
  for (const img of images) {
    lines.push(`![Image ${img.index}](${img.dataUri})`);
    lines.push('');
    lines.push(`> **Image Description:** ${img.description}`);
    lines.push('');
  }

  // Handle tables
  for (const table of doclingOutput.tables || []) {
    lines.push(tableToMarkdown(table));
    lines.push('');
  }

  return lines.join('\n');
}

function tableToMarkdown(table: any): string {
  if (!table.data?.table_cells) return '';

  const { num_rows, num_cols, table_cells } = table.data;
  const grid: string[][] = Array(num_rows).fill(null).map(() => Array(num_cols).fill(''));

  for (const cell of table_cells) {
    const row = cell.start_row_offset_idx;
    const col = cell.start_col_offset_idx;
    if (row < num_rows && col < num_cols) {
      grid[row][col] = cell.text || '';
    }
  }

  const lines: string[] = [];

  // Header row
  if (grid.length > 0) {
    lines.push('| ' + grid[0].join(' | ') + ' |');
    lines.push('| ' + grid[0].map(() => '---').join(' | ') + ' |');

    // Data rows
    for (let i = 1; i < grid.length; i++) {
      lines.push('| ' + grid[i].join(' | ') + ' |');
    }
  }

  return lines.join('\n');
}

function assembleMarkdown(
  frontmatter: string,
  content: string,
  inputPath: string
): string {
  const footer = `
---

<!-- CONVERSION FOOTER -->
<!-- Converted by DoclingConverter v2.0.0 -->
<!-- Source: ${inputPath} -->
<!-- Processed: ${new Date().toISOString()} -->
`;

  return `${frontmatter}\n\n${content}${footer}`;
}

function generateOutputPath(inputPath: string): string {
  const dir = dirname(inputPath);
  const name = basename(inputPath, extname(inputPath));
  return join(dir, `${name}.converted.md`);
}

// ============================================================================
// Output Formatting
// ============================================================================

function printResult(result: ConversionResult, totalMs: number): void {
  const outputSizeKb = Math.round(result.outputSizeBytes / 1024);

  console.log(`
${'='.repeat(50)}
SUMMARY: Converted ${basename(result.inputPath)} to embedding-ready markdown

ANALYSIS:
  - Format: ${result.sourceFormat}
  - Pages: ${result.pageCount}
  - Images: ${result.imageCount} (${result.imagesDescribed} described)
  - Language: ${result.sourceLanguage}${result.translated ? ' -> en' : ''}
  - Image model: ${result.imageDescriptionModel}

ACTIONS:
  - Docling conversion: ${result.conversionTimeMs}ms
  - Image processing: ${result.imageProcessingTimeMs}ms
  - Translation: ${result.translationTimeMs}ms
  - Total: ${totalMs}ms

RESULTS:
  - Output: ${result.outputPath}
  - Size: ${outputSizeKb}KB

NEXT:
  1. Review converted document
  2. Verify image descriptions
  3. Process with chunking pipeline

romeo: Document converted, ${result.imageCount} images processed.
${'='.repeat(50)}
`);
}

// ============================================================================
// Entry Point
// ============================================================================

if (import.meta.main) {
  main();
}

// Export for programmatic use
export { convertSingleFile, runBatchConversion };
