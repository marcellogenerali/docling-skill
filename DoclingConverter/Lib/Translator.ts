/**
 * Translator.ts - LLM-powered translation to English
 */

import Anthropic from '@anthropic-ai/sdk';
import type { TranslationResult } from './Types.ts';

// ============================================================================
// Configuration
// ============================================================================

const HAIKU_MODEL = 'claude-3-haiku-20240307';
const MAX_CHUNK_CHARS = 8000; // ~2000 tokens per chunk
const SUPPORTED_LANGUAGES = [
  'en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'ru', 'ja', 'ko', 'zh', 'ar'
];

const TRANSLATION_PROMPT = `Process the following text and ensure ALL natural language is in English.

CRITICAL RULES:
1. Translate ANY non-English text to clear, professional English
   - This includes mixed-language documents (e.g., Italian/English, Spanish/English)
   - If a sentence or paragraph is in a foreign language, translate it
   - Keep text that is ALREADY in English exactly as-is

2. Preserve ALL formatting exactly:
   - Markdown syntax (headers, lists, bold, italic, code blocks)
   - Table structures
   - Line breaks and paragraph structure
   - URLs, file paths, and code snippets

3. DO NOT translate these - keep them exactly as written:
   - Technical acronyms (API, SDK, HTTP, PDF, HTML, CSS, SQL, REST, CRUD, JSON, XML, etc.)
   - Programming terms and identifiers (function names, variable names, class names)
   - Brand names and product names (e.g., Doxee, Microsoft, Google)
   - File extensions (.pdf, .docx, .ts, etc.)
   - Version numbers and technical specifications
   - Code blocks and inline code

Respond with ONLY the processed text, no preamble or explanation.

Text to process:
{text}`;

const LANGUAGE_DETECTION_PROMPT = `Analyze the following text and determine its primary language.
Respond with ONLY the ISO 639-1 language code (e.g., "en", "de", "fr", "es", "zh", "ja").

Text:
{text}`;

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Detect the language of a text
 */
export async function detectLanguage(
  content: string,
  doclingLanguage?: string
): Promise<string> {
  // Use Docling's detected language if available
  if (doclingLanguage && SUPPORTED_LANGUAGES.includes(doclingLanguage.toLowerCase())) {
    return doclingLanguage.toLowerCase();
  }

  // Otherwise, use LLM to detect
  const sample = content.substring(0, 500);

  if (!process.env.ANTHROPIC_API_KEY) {
    // Default to English if we can't detect
    return 'en';
  }

  try {
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 10,
      messages: [
        {
          role: 'user',
          content: LANGUAGE_DETECTION_PROMPT.replace('{text}', sample),
        },
      ],
    });

    const textBlock = response.content.find(block => block.type === 'text');
    const detected = textBlock
      ? (textBlock as { type: 'text'; text: string }).text.trim().toLowerCase()
      : 'en';

    // Validate it's a known language code
    return SUPPORTED_LANGUAGES.includes(detected) ? detected : 'en';
  } catch {
    return 'en';
  }
}

/**
 * Check if translation is needed
 */
export function needsTranslation(sourceLanguage: string): boolean {
  return sourceLanguage.toLowerCase() !== 'en';
}

/**
 * Translate content to English
 * Always runs translation to handle mixed-language documents
 */
export async function translate(
  content: string,
  sourceLanguage: string
): Promise<TranslationResult> {
  // Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('Translation skipped: ANTHROPIC_API_KEY not set');
    return {
      content,
      sourceLanguage,
      targetLanguage: sourceLanguage,
      translated: false,
      model: null,
      chunksTranslated: 0,
    };
  }

  try {
    // Split into chunks for long documents
    const chunks = splitIntoChunks(content);
    const translatedChunks: string[] = [];

    const anthropic = new Anthropic();

    for (const chunk of chunks) {
      const response = await anthropic.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: TRANSLATION_PROMPT.replace('{text}', chunk),
          },
        ],
      });

      const textBlock = response.content.find(block => block.type === 'text');
      const translated = textBlock
        ? (textBlock as { type: 'text'; text: string }).text
        : chunk;

      translatedChunks.push(translated);
    }

    return {
      content: translatedChunks.join('\n\n'),
      sourceLanguage,
      targetLanguage: 'en',
      translated: true,
      model: HAIKU_MODEL,
      chunksTranslated: chunks.length,
    };
  } catch (error) {
    console.error('Translation failed:', error);
    return {
      content,
      sourceLanguage,
      targetLanguage: sourceLanguage,
      translated: false,
      model: null,
      chunksTranslated: 0,
    };
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Split content into chunks for translation
 * Tries to split at paragraph boundaries
 */
function splitIntoChunks(content: string): string[] {
  if (content.length <= MAX_CHUNK_CHARS) {
    return [content];
  }

  const chunks: string[] = [];
  const paragraphs = content.split(/\n\n+/);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > MAX_CHUNK_CHARS) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      // Handle paragraphs larger than chunk size
      if (paragraph.length > MAX_CHUNK_CHARS) {
        const subChunks = splitLongParagraph(paragraph);
        chunks.push(...subChunks);
        currentChunk = '';
      } else {
        currentChunk = paragraph;
      }
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Split a long paragraph into smaller chunks at sentence boundaries
 */
function splitLongParagraph(paragraph: string): string[] {
  const chunks: string[] = [];
  const sentences = paragraph.split(/(?<=[.!?])\s+/);
  let currentChunk = '';

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > MAX_CHUNK_CHARS) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
