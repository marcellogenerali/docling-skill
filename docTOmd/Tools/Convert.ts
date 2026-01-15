#!/usr/bin/env bun
/**
 * Convert.ts - Document Conversion Tool with Page-Based Image Organization
 *
 * Converts documents to markdown using Docling with external images organized by page.
 * No LLM processing, no translation - pure docling output.
 *
 * Usage:
 *   bun run Convert.ts <file_path> [options]
 *
 * Options:
 *   --output, -o <path>   Custom output path
 *   --assets-dir <path>   Custom assets directory (default: {name}-images/)
 *   --ocr                 Force OCR processing
 *   --vlm                 Use Vision Language Model pipeline
 *   --help, -h            Show help
 */

import { parseArgs } from 'util';
import { existsSync, writeFileSync, statSync } from 'fs';
import { resolve, dirname, basename, extname, join } from 'path';

import {
  convert as doclingConvert,
  checkDoclingInstalled,
  getDoclingVersion,
  getFormat,
  isSupported,
  cleanupTempFiles,
} from '../Lib/DoclingClient.ts';
import { saveImagesExternal } from '../Lib/ImageProcessor.ts';
import { generateFrontmatter } from '../Lib/MetadataBuilder.ts';
import type {
  ConversionOptions,
  DoclingOutput,
  ExternalImage,
} from '../Lib/Types.ts';

// ============================================================================
// CLI Interface
// ============================================================================

const HELP_TEXT = `
docTOmd - Convert documents to markdown with page-organized images

USAGE:
  bun run Convert.ts <file_path> [options]

OPTIONS:
  --output, -o <path>   Custom output path (default: same directory)
  --assets-dir <path>   Custom assets directory (default: {name}-images/)
  --ocr                 Force OCR processing for scanned documents
  --vlm                 Use Vision Language Model pipeline
  --help, -h            Show this help message

IMAGE ORGANIZATION:
  Images are automatically saved in page-based subdirectories:
    doc-images/page-001/image-001.png
    doc-images/page-001/image-002.png
    doc-images/page-002/image-003.png

EXAMPLES:
  bun run Convert.ts report.pdf
  bun run Convert.ts document.docx --output /output/doc.md
  bun run Convert.ts scanned.pdf --ocr
  bun run Convert.ts report.pdf --assets-dir custom-images

SUPPORTED FORMATS:
  PDF, DOCX, XLSX, HTML, Markdown, Images (PNG, JPG, TIFF)
`;

function main(): void {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      output: { type: 'string', short: 'o' },
      'assets-dir': { type: 'string' },
      ocr: { type: 'boolean', default: false },
      vlm: { type: 'boolean', default: false },
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
    console.error('Error: No input file specified');
    console.log('Use --help for usage information');
    process.exit(1);
  }

  convertDocument(inputPath, {
    inputPath,
    outputPath: values.output,
    assetsDir: values['assets-dir'],
    ocr: values.ocr,
    vlm: values.vlm,
  }).catch(error => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
}

// ============================================================================
// Main Conversion Logic
// ============================================================================

async function convertDocument(
  inputPath: string,
  options: ConversionOptions
): Promise<void> {
  const absolutePath = resolve(inputPath);
  const startTime = Date.now();

  // Validate input
  if (!existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const format = getFormat(absolutePath);
  if (!isSupported(format)) {
    throw new Error(`Unsupported format: ${format}`);
  }

  console.log(`\nConverting: ${basename(absolutePath)}`);

  // Check docling
  const doclingInstalled = await checkDoclingInstalled();
  if (!doclingInstalled) {
    throw new Error('Docling CLI not installed. Run: pip install docling>=2.67.0');
  }

  const doclingVersion = await getDoclingVersion();

  // Run docling conversion
  console.log('  Running Docling...');
  const doclingOutput = await doclingConvert(absolutePath, options);

  // Determine output path
  const outputPath = options.outputPath || generateOutputPath(absolutePath);
  const outputDir = dirname(outputPath);
  const docName = basename(outputPath, '.md');

  // Save images as external files with page-based organization
  const assetsDir = options.assetsDir || join(outputDir, `${docName}-images`);
  console.log('  Saving images...');
  const externalImages = saveImagesExternal(doclingOutput, assetsDir, outputPath);
  const imageCount = externalImages.length;

  if (imageCount > 0) {
    console.log(`  Saved ${imageCount} images to ${basename(assetsDir)}/ (organized by page)`);
  }

  // Convert to markdown with external image paths
  console.log('  Generating markdown...');
  const markdown = doclingOutputToMarkdownExternal(doclingOutput, externalImages);

  // Generate frontmatter
  const pipelineUsed = options.vlm ? 'vlm' : (options.ocr ? 'ocr' : 'standard');
  const frontmatter = generateFrontmatter({
    inputPath: absolutePath,
    doclingOutput,
    doclingVersion,
    imageCount,
    markdownContent: markdown,
    pipelineUsed,
  });

  // Assemble final output
  const finalMarkdown = `${frontmatter}\n\n${markdown}`;

  // Write output
  writeFileSync(outputPath, finalMarkdown, 'utf-8');

  // Cleanup temp files
  cleanupTempFiles(doclingOutput);

  // Print result
  const totalTime = Date.now() - startTime;
  const outputStats = statSync(outputPath);
  const outputSizeKb = Math.round(outputStats.size / 1024);

  console.log(`
Done!
  Output: ${outputPath}
  Size: ${outputSizeKb}KB
  Images: ${imageCount}${imageCount > 0 ? ' (in page-organized directories)' : ''}
  Time: ${totalTime}ms
`);
}

// ============================================================================
// Markdown Generation - Recursive traversal following children order
// ============================================================================

/**
 * Convert docling output to markdown with external image files
 */
function doclingOutputToMarkdownExternal(
  doclingOutput: DoclingOutput,
  images: ExternalImage[]
): string {
  const lines: string[] = [];
  const texts = doclingOutput.texts || [];
  const tables = doclingOutput.tables || [];
  const pictures = doclingOutput.pictures || [];
  const groups = (doclingOutput as any).groups || [];
  const body = doclingOutput.body;

  const elementsMap = new Map<string, any>();
  for (const t of texts) elementsMap.set(t.self_ref, { ...t, type: 'text' });
  for (const t of tables) elementsMap.set(t.self_ref, { ...t, type: 'table' });
  for (const p of pictures) elementsMap.set(p.self_ref, { ...p, type: 'picture' });
  for (const g of groups) elementsMap.set(g.self_ref, { ...g, type: 'group' });

  const rendered = new Set<string>();
  let currentListItems: string[] = [];
  let asciiArtBuffer: string[] = [];
  const BOX_DRAWING_CHARS = /[┌┐└┘─│├┤┬┴┼▼▲►◄→←↓↑╔╗╚╝═║╠╣╦╩╬]/;

  function isAsciiArt(text: string): boolean {
    return BOX_DRAWING_CHARS.test(text);
  }

  function flushAsciiArt() {
    if (asciiArtBuffer.length > 0) {
      lines.push('```');
      for (const line of asciiArtBuffer) lines.push(line);
      lines.push('```');
      lines.push('');
      asciiArtBuffer = [];
    }
  }

  function flushList() {
    if (currentListItems.length > 0) {
      flushAsciiArt();
      for (const item of currentListItems) lines.push(item);
      lines.push('');
      currentListItems = [];
    }
  }

  function formatTextWithLink(element: any): string {
    let text = element.text || '';
    if (element.hyperlink && element.hyperlink !== '.') {
      text = `[${text}](${element.hyperlink})`;
    }
    return text;
  }

  function getInlineGroupText(group: any): string {
    if (!group.children) return '';
    const parts: string[] = [];
    for (const childRef of group.children) {
      const child = elementsMap.get(childRef.$ref);
      if (child?.text) {
        let text = child.text;
        if (child.hyperlink && child.hyperlink !== '.') {
          text = `[${text}](${child.hyperlink})`;
        }
        parts.push(text);
      }
    }
    return parts.join('');
  }

  function renderTable(table: any): string {
    if (!table.data?.table_cells) return '';
    const { num_rows, num_cols, table_cells } = table.data;
    const grid: string[][] = Array(num_rows).fill(null).map(() => Array(num_cols).fill(''));
    for (const cell of table_cells) {
      const row = cell.start_row_offset_idx;
      const col = cell.start_col_offset_idx;
      if (row < num_rows && col < num_cols) {
        grid[row][col] = (cell.text || '').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
      }
    }
    const tableLines: string[] = [];
    if (grid.length > 0) {
      tableLines.push('| ' + grid[0].join(' | ') + ' |');
      tableLines.push('| ' + grid[0].map(() => '---').join(' | ') + ' |');
      for (let i = 1; i < grid.length; i++) {
        tableLines.push('| ' + grid[i].join(' | ') + ' |');
      }
    }
    return tableLines.join('\n');
  }

  function markDescendantsRendered(element: any) {
    if (!element.children) return;
    for (const childRef of element.children) {
      const ref = childRef.$ref;
      rendered.add(ref);
      const child = elementsMap.get(ref);
      if (child) markDescendantsRendered(child);
    }
  }

  // Render image with external file path
  function renderImage(picture: any) {
    const idx = parseInt((picture.self_ref || '').split('/').pop() || '0');
    const img = images.find(i => i.index === idx + 1);
    if (img) {
      lines.push(`![Image ${img.index}](${img.relativePath})`);
      lines.push('');
    }
  }

  function renderElement(ref: string) {
    if (rendered.has(ref)) return;
    rendered.add(ref);
    const element = elementsMap.get(ref);
    if (!element) return;
    const type = element.type;

    if (type === 'text') {
      switch (element.label) {
        case 'section_header':
          flushList();
          flushAsciiArt();
          const level = element.level || 1;
          lines.push(`${'#'.repeat(Math.min(level, 6))} ${formatTextWithLink(element)}`);
          lines.push('');
          break;
        case 'paragraph':
        case 'text':
          flushList();
          if (element.text) {
            if (isAsciiArt(element.text)) {
              asciiArtBuffer.push(element.text);
            } else {
              flushAsciiArt();
              lines.push(formatTextWithLink(element));
              lines.push('');
            }
          }
          break;
        case 'list_item':
          const marker = element.enumerated ? `${element.marker || '1.'}` : '-';
          const listItemText = formatTextWithLink(element);
          if (listItemText.trim()) currentListItems.push(`${marker} ${listItemText}`);
          break;
        case 'code':
          flushList();
          flushAsciiArt();
          const lang = element.code_language || '';
          lines.push(`\`\`\`${lang}`);
          lines.push(element.text || '');
          lines.push('```');
          lines.push('');
          break;
        default:
          if (element.text) {
            flushList();
            flushAsciiArt();
            lines.push(formatTextWithLink(element));
            lines.push('');
          }
          break;
      }
      if (element.children) {
        for (const childRef of element.children) renderElement(childRef.$ref);
      }
    } else if (type === 'table') {
      flushList();
      flushAsciiArt();
      lines.push(renderTable(element));
      lines.push('');
      markDescendantsRendered(element);
    } else if (type === 'picture') {
      flushList();
      flushAsciiArt();
      renderImage(element);
    } else if (type === 'group') {
      if (element.label === 'inline') {
        flushList();
        flushAsciiArt();
        const groupText = getInlineGroupText(element);
        if (groupText) {
          lines.push(groupText);
          lines.push('');
        }
        if (element.children) {
          for (const childRef of element.children) rendered.add(childRef.$ref);
        }
      } else {
        if (element.children) {
          for (const childRef of element.children) renderElement(childRef.$ref);
        }
      }
    }
  }

  if (body?.children) {
    for (const childRef of body.children) renderElement(childRef.$ref);
  }
  flushList();
  flushAsciiArt();

  for (const element of [...texts, ...tables, ...pictures]) {
    if (!rendered.has(element.self_ref)) renderElement(element.self_ref);
  }
  flushList();
  flushAsciiArt();

  return lines.join('\n');
}

function generateOutputPath(inputPath: string): string {
  const dir = dirname(inputPath);
  const name = basename(inputPath, extname(inputPath));
  return join(dir, `${name}.md`);
}

// ============================================================================
// Entry Point
// ============================================================================

if (import.meta.main) {
  main();
}

export { convertDocument };
