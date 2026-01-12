/**
 * ImageProcessor.ts - Image compression and base64 encoding with Sharp
 */

import sharp from 'sharp';
import { readFileSync, statSync } from 'fs';
import { extname } from 'path';
import type { CompressedImage } from './Types.ts';

// ============================================================================
// Configuration
// ============================================================================

const COMPRESSION_CONFIG = {
  maxWidth: 1200,
  jpegQuality: 80,
  pngCompressionLevel: 9,
  targetReduction: 0.7, // Target 70% size reduction
};

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Compress an image and convert to base64 data URI
 */
export async function compressImage(imagePath: string): Promise<CompressedImage> {
  // Get original file stats
  const stats = statSync(imagePath);
  const originalSizeBytes = stats.size;

  // Determine output format
  const format = selectFormat(imagePath);

  // Load and process image with Sharp
  let pipeline = sharp(imagePath);

  // Get original metadata
  const metadata = await pipeline.metadata();
  const originalWidth = metadata.width || 0;
  const originalHeight = metadata.height || 0;

  // Resize if larger than max width (preserve aspect ratio)
  if (originalWidth > COMPRESSION_CONFIG.maxWidth) {
    pipeline = pipeline.resize(COMPRESSION_CONFIG.maxWidth, null, {
      withoutEnlargement: true,
      fit: 'inside',
    });
  }

  // Apply format-specific compression
  let buffer: Buffer;
  if (format === 'jpeg') {
    buffer = await pipeline
      .jpeg({ quality: COMPRESSION_CONFIG.jpegQuality, mozjpeg: true })
      .toBuffer();
  } else {
    buffer = await pipeline
      .png({ compressionLevel: COMPRESSION_CONFIG.pngCompressionLevel })
      .toBuffer();
  }

  // Get compressed dimensions
  const compressedMeta = await sharp(buffer).metadata();
  const width = compressedMeta.width || originalWidth;
  const height = compressedMeta.height || originalHeight;

  // Calculate compression ratio
  const compressedSizeBytes = buffer.length;
  const compressionRatio = compressedSizeBytes / originalSizeBytes;

  // Convert to base64 data URI
  const base64 = buffer.toString('base64');
  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const dataUri = `data:${mimeType};base64,${base64}`;

  return {
    originalPath: imagePath,
    originalSizeBytes,
    compressedSizeBytes,
    width,
    height,
    format,
    base64,
    dataUri,
    compressionRatio,
  };
}

/**
 * Process multiple images in sequence (to avoid memory issues)
 */
export async function processImages(
  imagePaths: string[]
): Promise<CompressedImage[]> {
  const results: CompressedImage[] = [];

  for (const imagePath of imagePaths) {
    try {
      const compressed = await compressImage(imagePath);
      results.push(compressed);
    } catch (error) {
      console.error(`Failed to process image ${imagePath}:`, error);
      // Create a placeholder for failed images
      results.push(createPlaceholder(imagePath));
    }
  }

  return results;
}

/**
 * Process images from base64 data URIs (from docling JSON output)
 */
export async function processImagesFromDataUri(
  dataUris: { uri: string; size?: { width: number; height: number } }[]
): Promise<CompressedImage[]> {
  const results: CompressedImage[] = [];

  for (let i = 0; i < dataUris.length; i++) {
    const { uri, size } = dataUris[i];
    try {
      const compressed = await compressDataUri(uri, `image_${i}`, size);
      results.push(compressed);
    } catch (error) {
      console.error(`Failed to process image ${i}:`, error);
      results.push(createPlaceholder(`image_${i}`));
    }
  }

  return results;
}

/**
 * Compress an image from a data URI
 */
async function compressDataUri(
  dataUri: string,
  identifier: string,
  originalSize?: { width: number; height: number }
): Promise<CompressedImage> {
  // Parse data URI - handle various formats
  // Format: data:[<mediatype>][;base64],<data>
  const dataUriPrefix = 'data:';
  const base64Marker = ';base64,';

  if (!dataUri.startsWith(dataUriPrefix)) {
    throw new Error(`Invalid data URI format: does not start with ${dataUriPrefix}`);
  }

  const base64Index = dataUri.indexOf(base64Marker);
  if (base64Index === -1) {
    throw new Error('Invalid data URI format: missing ;base64, marker');
  }

  const mimeType = dataUri.slice(dataUriPrefix.length, base64Index);
  const base64Data = dataUri.slice(base64Index + base64Marker.length);
  const originalBuffer = Buffer.from(base64Data, 'base64');
  const originalSizeBytes = originalBuffer.length;

  // Determine format from mime type
  const isSourcePng = mimeType.includes('png');
  const format: 'jpeg' | 'png' = isSourcePng ? 'png' : 'jpeg';

  // Load and process image with Sharp
  let pipeline = sharp(originalBuffer);

  // Get metadata
  const metadata = await pipeline.metadata();
  const originalWidth = originalSize?.width || metadata.width || 0;
  const originalHeight = originalSize?.height || metadata.height || 0;

  // Resize if larger than max width (preserve aspect ratio)
  if (originalWidth > COMPRESSION_CONFIG.maxWidth) {
    pipeline = pipeline.resize(COMPRESSION_CONFIG.maxWidth, null, {
      withoutEnlargement: true,
      fit: 'inside',
    });
  }

  // Apply format-specific compression
  let buffer: Buffer;
  if (format === 'jpeg') {
    buffer = await pipeline
      .jpeg({ quality: COMPRESSION_CONFIG.jpegQuality, mozjpeg: true })
      .toBuffer();
  } else {
    buffer = await pipeline
      .png({ compressionLevel: COMPRESSION_CONFIG.pngCompressionLevel })
      .toBuffer();
  }

  // Get compressed dimensions
  const compressedMeta = await sharp(buffer).metadata();
  const width = compressedMeta.width || originalWidth;
  const height = compressedMeta.height || originalHeight;

  // Calculate compression ratio
  const compressedSizeBytes = buffer.length;
  const compressionRatio = originalSizeBytes > 0 ? compressedSizeBytes / originalSizeBytes : 1;

  // Convert to base64 data URI
  const compressedBase64 = buffer.toString('base64');
  const outputMimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const outputDataUri = `data:${outputMimeType};base64,${compressedBase64}`;

  return {
    originalPath: identifier,
    originalSizeBytes,
    compressedSizeBytes,
    width,
    height,
    format,
    base64: compressedBase64,
    dataUri: outputDataUri,
    compressionRatio,
  };
}

/**
 * Determine the best output format for an image
 * - JPEG for photographs (complex, many colors)
 * - PNG for diagrams, screenshots, text-heavy images
 */
export function selectFormat(imagePath: string): 'jpeg' | 'png' {
  const ext = extname(imagePath).toLowerCase();

  // Preserve PNG for known diagram/screenshot formats
  if (ext === '.png' || ext === '.gif' || ext === '.bmp') {
    return 'png';
  }

  // Default to JPEG for photos
  return 'jpeg';
}

/**
 * Create a placeholder for failed image processing
 */
function createPlaceholder(imagePath: string): CompressedImage {
  // Create a minimal 1x1 transparent PNG
  const transparentPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

  return {
    originalPath: imagePath,
    originalSizeBytes: 0,
    compressedSizeBytes: 0,
    width: 1,
    height: 1,
    format: 'png',
    base64: transparentPng,
    dataUri: `data:image/png;base64,${transparentPng}`,
    compressionRatio: 1,
  };
}

/**
 * Calculate aggregate compression statistics
 */
export function calculateCompressionStats(images: CompressedImage[]): {
  totalOriginalBytes: number;
  totalCompressedBytes: number;
  averageCompressionRatio: number;
  totalSavedBytes: number;
} {
  const totalOriginalBytes = images.reduce((sum, img) => sum + img.originalSizeBytes, 0);
  const totalCompressedBytes = images.reduce((sum, img) => sum + img.compressedSizeBytes, 0);
  const averageCompressionRatio = totalOriginalBytes > 0
    ? totalCompressedBytes / totalOriginalBytes
    : 1;
  const totalSavedBytes = totalOriginalBytes - totalCompressedBytes;

  return {
    totalOriginalBytes,
    totalCompressedBytes,
    averageCompressionRatio,
    totalSavedBytes,
  };
}
