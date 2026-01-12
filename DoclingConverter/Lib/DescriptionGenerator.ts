/**
 * DescriptionGenerator.ts - LLM-powered image description with fallback chain
 *
 * Fallback chain: internVL3_5:4B (Ollama) -> Claude Haiku -> skip
 */

import Anthropic from '@anthropic-ai/sdk';
import { Ollama } from 'ollama';
import type { ImageModelConfig, ImageContext, ProcessedImage, CompressedImage } from './Types.ts';

// ============================================================================
// Configuration
// ============================================================================

const OLLAMA_MODEL = 'blaifa/InternVL3_5:4B';
const HAIKU_MODEL = 'claude-3-haiku-20240307';

const DESCRIPTION_PROMPT = `You are analyzing an image extracted from a document.

Context:
- Document title: {title}
- Current section: {headingPath}
- Surrounding text: {contextSnippet}

Describe this image in 2-3 sentences. Focus on:
1. What the image shows (diagram, photo, chart, screenshot, etc.)
2. Key information it conveys
3. Its relevance to the surrounding content

Write the description to enable semantic search - someone should be able to find this image by searching for concepts it illustrates.

Respond with ONLY the description, no preamble or formatting.`;

// ============================================================================
// Model Selection (Fallback Chain)
// ============================================================================

let cachedModelConfig: ImageModelConfig | null = null;

/**
 * Select the best available image description model
 * Fallback chain: Ollama internVL -> Anthropic Haiku -> skip
 */
export async function selectImageModel(): Promise<ImageModelConfig> {
  // Return cached result if available
  if (cachedModelConfig) {
    return cachedModelConfig;
  }

  // 1. Try Ollama with internVL
  if (await checkOllama(OLLAMA_MODEL)) {
    cachedModelConfig = {
      provider: 'ollama',
      model: OLLAMA_MODEL,
      cost: 0,
    };
    return cachedModelConfig;
  }

  // 2. Try Anthropic Haiku
  if (checkAnthropicKey()) {
    cachedModelConfig = {
      provider: 'anthropic',
      model: HAIKU_MODEL,
      cost: 0.00025, // ~$0.25 per 1M input tokens
    };
    return cachedModelConfig;
  }

  // 3. Skip descriptions
  cachedModelConfig = {
    provider: 'none',
    model: 'skipped',
    cost: 0,
  };
  return cachedModelConfig;
}

/**
 * Check if Ollama is available with the specified model
 */
async function checkOllama(modelName: string): Promise<boolean> {
  try {
    const ollama = new Ollama();
    const models = await ollama.list();
    return models.models.some(m => m.name.includes(modelName.split(':')[0]));
  } catch {
    return false;
  }
}

/**
 * Check if Anthropic API key is available
 */
function checkAnthropicKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// ============================================================================
// Description Generation
// ============================================================================

/**
 * Generate a description for a single image
 */
export async function describeImage(
  imageBase64: string,
  context: ImageContext,
  modelConfig: ImageModelConfig
): Promise<string> {
  if (modelConfig.provider === 'none') {
    return '[No description available - vision model unavailable]';
  }

  const prompt = formatPrompt(context);

  try {
    if (modelConfig.provider === 'ollama') {
      return await describeWithOllama(imageBase64, prompt, modelConfig.model);
    } else if (modelConfig.provider === 'anthropic') {
      return await describeWithAnthropic(imageBase64, prompt);
    }
  } catch (error) {
    console.error('Image description failed:', error);
    return '[No description available - generation failed]';
  }

  return '[No description available]';
}

/**
 * Generate descriptions for multiple images
 */
export async function describeImages(
  images: CompressedImage[],
  contexts: ImageContext[],
  modelConfig: ImageModelConfig
): Promise<ProcessedImage[]> {
  const results: ProcessedImage[] = [];

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const context = contexts[i] || createDefaultContext(i);

    let description: string;
    let descriptionGenerated = false;

    if (modelConfig.provider !== 'none') {
      description = await describeImage(image.base64, context, modelConfig);
      descriptionGenerated = !description.includes('[No description available');
    } else {
      description = '[No description available - vision model unavailable]';
    }

    results.push({
      ...image,
      index: i + 1,
      description,
      descriptionGenerated,
      descriptionModel: descriptionGenerated ? modelConfig.model : null,
    });
  }

  return results;
}

// ============================================================================
// Provider-Specific Implementations
// ============================================================================

async function describeWithOllama(
  imageBase64: string,
  prompt: string,
  model: string
): Promise<string> {
  const ollama = new Ollama();

  const response = await ollama.chat({
    model,
    messages: [
      {
        role: 'user',
        content: prompt,
        images: [imageBase64],
      },
    ],
  });

  return response.message.content.trim();
}

async function describeWithAnthropic(
  imageBase64: string,
  prompt: string
): Promise<string> {
  const anthropic = new Anthropic();

  const response = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find(block => block.type === 'text');
  return textBlock ? (textBlock as { type: 'text'; text: string }).text.trim() : '';
}

// ============================================================================
// Helpers
// ============================================================================

function formatPrompt(context: ImageContext): string {
  return DESCRIPTION_PROMPT
    .replace('{title}', context.documentTitle || 'Untitled Document')
    .replace('{headingPath}', context.headingPath.join(' > ') || 'Document root')
    .replace('{contextSnippet}', truncate(context.surroundingText, 200) || 'No surrounding text');
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function createDefaultContext(_index: number): ImageContext {
  return {
    documentTitle: 'Document',
    headingPath: [],
    surroundingText: '',
    pageNumber: 1,
  };
}

/**
 * Reset the cached model config (useful for testing)
 */
export function resetModelCache(): void {
  cachedModelConfig = null;
}
