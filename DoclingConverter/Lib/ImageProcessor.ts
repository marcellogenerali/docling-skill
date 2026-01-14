/**
 * ImageProcessor.ts - Save images from Docling output to page-organized directories
 *
 * Images are always saved externally with a page-based folder structure:
 * doc-images/
 *   page-001/
 *     image-001.png
 *     image-002.png
 *   page-002/
 *     image-003.png
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, relative, dirname } from 'path';
import type { DoclingOutput, ExternalImage } from './Types.ts';

/**
 * Save images as external files organized by page number
 */
export function saveImagesExternal(
  doclingOutput: DoclingOutput,
  assetsDir: string,
  markdownPath: string
): ExternalImage[] {
  if (!doclingOutput.pictures) {
    return [];
  }

  // Ensure base assets directory exists
  if (!existsSync(assetsDir)) {
    mkdirSync(assetsDir, { recursive: true });
  }

  const markdownDir = dirname(markdownPath);
  const externalImages: ExternalImage[] = [];

  const pictures = doclingOutput.pictures.filter(pic => pic.image?.uri?.startsWith('data:'));

  for (let i = 0; i < pictures.length; i++) {
    const pic = pictures[i];
    const dataUri = pic.image!.uri;

    // Parse data URI: data:image/png;base64,xxxxx
    const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) continue;

    const mimeType = match[1];
    const base64Data = match[2];

    // Get page number from provenance (default to 1 if not available)
    const pageNumber = pic.prov?.[0]?.page_no ?? 1;
    const pageDir = `page-${String(pageNumber).padStart(3, '0')}`;
    const pageDirPath = join(assetsDir, pageDir);

    // Ensure page directory exists
    if (!existsSync(pageDirPath)) {
      mkdirSync(pageDirPath, { recursive: true });
    }

    // Determine extension from mime type
    const ext = getExtensionFromMime(mimeType);
    const filename = `image-${String(i + 1).padStart(3, '0')}.${ext}`;
    const absolutePath = join(pageDirPath, filename);

    // Write file
    const buffer = Buffer.from(base64Data, 'base64');
    writeFileSync(absolutePath, buffer);

    // Calculate relative path from markdown file to image
    const relativePath = './' + relative(markdownDir, absolutePath);

    externalImages.push({
      index: i + 1,
      pageNumber,
      filename,
      relativePath,
      absolutePath,
      width: pic.image!.size?.width || 0,
      height: pic.image!.size?.height || 0,
      mimeType,
    });
  }

  return externalImages;
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMime(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/tiff': 'tiff',
    'image/bmp': 'bmp',
    'image/svg+xml': 'svg',
  };
  return mimeMap[mimeType] || 'png';
}
