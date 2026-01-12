# DoclingConverter Skill - Product Requirements Document

**Version:** 2.0.0
**Date:** 2026-01-12
**Status:** FINAL - Approved for Implementation

---

## Executive Summary

A Claude Code skill that converts documents from various formats into well-structured, AI-embedding-ready markdown files using the Docling library. Output is optimized for downstream chunking and vector database ingestion with rich metadata, compressed embedded images with contextual descriptions, and automatic English translation.

---

## Problem Statement

When preparing documents for AI/RAG systems, users face several challenges:

1. **Format fragmentation** - Documents exist in PDF, DOCX, PPTX, XLSX, HTML, and image formats
2. **Loss of structure** - Standard converters lose tables, code blocks, formulas, and reading order
3. **Missing metadata** - No standardized way to track document origin and processing info
4. **Image bloat** - Images are either lost or too large for embedding pipelines
5. **Language barriers** - Documents in various languages need normalization to English
6. **No image context** - Images lack textual descriptions for semantic search

---

## Solution Overview

The `DoclingConverter` skill provides a single command to convert any supported document into embedding-ready markdown with:

- Preserved document structure (tables, code, formulas)
- Compressed base64-embedded images with AI-generated contextual descriptions
- Rich YAML frontmatter metadata optimized for chunking pipelines
- Automatic translation to English
- Sequential pipeline processing for batch operations

---

## Supported Input Formats

| Format     | Extensions                               | Notes                                      |
| ---------- | ---------------------------------------- | ------------------------------------------ |
| PDF        | `.pdf`                                 | Advanced layout understanding, OCR support |
| Word       | `.docx`                                | Full formatting preservation               |
| PowerPoint | `.pptx`                                | Slide-by-slide conversion                  |
| Excel      | `.xlsx`                                | Table extraction                           |
| HTML       | `.html`, `.htm`                      | Web page conversion                        |
| Markdown   | `.md`                                  | Re-processing/normalization                |
| Images     | `.png`, `.jpg`, `.jpeg`, `.tiff` | OCR-based extraction                       |
| Audio      | `.wav`, `.mp3`                       | ASR transcription                          |
| Subtitles  | `.vtt`                                 | WebVTT parsing                             |

---

## Output Specification

### Output Location

- **Default:** Same directory as input file
- **Naming:** `<original_name>.converted.md`
- **Override:** User can specify custom output path in prompt

### Markdown File Structure

```markdown
---
# === DOCUMENT IDENTITY ===
title: "Document Title"
source_file: "original_document.pdf"
source_path: "/absolute/path/to/original_document.pdf"
source_format: "pdf"
source_hash: "sha256:abc123..."
source_size_bytes: 2458923
source_language: "de"

# === PROCESSING INFO ===
converted_at: "2026-01-12T10:30:00Z"
converter: "docling"
converter_version: "2.67.0"
skill_version: "2.0.0"
pipeline_used: "standard"
ocr_applied: true
translated_to: "en"
translation_model: "claude-3-haiku"

# === LLM PROCESSING ===
image_description_model: "internvl3:4b"  # or "claude-3-haiku" or "skipped"
image_descriptions_generated: 8
image_descriptions_skipped: 0
translation_required: true

# === CONTENT METRICS (for chunking pipelines) ===
page_count: 15
section_count: 8
paragraph_count: 47
word_count: 4523
char_count: 28451
sentence_count: 198

# === STRUCTURAL ELEMENTS (for chunking decisions) ===
heading_hierarchy:
  h1: 3
  h2: 12
  h3: 24
has_tables: true
table_count: 4
has_code_blocks: true
code_block_count: 7
has_lists: true
list_count: 15
has_images: true
image_count: 8

# === IMAGE SUMMARY ===
images:
  - index: 1
    original_size_kb: 245
    compressed_size_kb: 48
    dimensions: "800x600"
    compression_ratio: 0.20
    description_generated: true
  - index: 2
    original_size_kb: 512
    compressed_size_kb: 89
    dimensions: "1200x800"
    compression_ratio: 0.17
    description_generated: true

# === SEMANTIC HINTS (for embedding optimization) ===
document_type: "technical_report"
primary_topics: ["machine learning", "document processing", "NLP"]
estimated_reading_time_minutes: 18
complexity_level: "technical"

# === CHUNKING RECOMMENDATIONS ===
recommended_chunk_size: 512
natural_break_points: 47
avg_paragraph_length: 96
---

# Document Title

Brief overview paragraph...

## Section 1

Content with **formatting** preserved and translated to English.

### Images

![Image 1](data:image/jpeg;base64,/9j/4AAQSkZJRg...)

> **Image Description:** A flowchart showing the document processing pipeline with three main stages: input parsing, content extraction, and markdown generation. The diagram uses blue boxes for processing steps and green boxes for output formats.

### Tables

| Column A | Column B |
|----------|----------|
| Data 1   | Data 2   |

---

<!-- CONVERSION FOOTER -->
<!-- Converted by DoclingConverter v2.0.0 | Docling v2.67.0 -->
<!-- Original: /path/to/original_document.pdf (de) → en -->
<!-- Processed: 2026-01-12T10:30:00Z -->
```

---

## LLM Dependencies

### Image Description Generation

**Fallback Chain:**

```
1. Check Ollama: blaifa/InternVL3_5:4B
   ├─ Available → Use for all image descriptions
   └─ Unavailable ↓

2. Check Claude API: claude-3-haiku
   ├─ Available → Use for all image descriptions
   └─ Unavailable ↓

3. Skip descriptions
   └─ Add "[No description available]" placeholder
   └─ Set image_description_model: "skipped" in metadata
```

**Detection Logic:**

```typescript
async function selectImageModel(): Promise<ImageModelConfig> {
  // 1. Try Ollama internVL
  const ollamaAvailable = await checkOllama('blaifa/InternVL3_5:4B');
  if (ollamaAvailable) {
    return { provider: 'ollama', model: 'blaifa/InternVL3_5:4B', cost: 0 };
  }

  // 2. Try Claude Haiku
  const haikuAvailable = await checkAnthropicKey();
  if (haikuAvailable) {
    return { provider: 'anthropic', model: 'claude-3-haiku-20240307', cost: 0.00025 };
  }

  // 3. Skip
  return { provider: 'none', model: 'skipped', cost: 0 };
}
```

### Translation

**Model:** Claude 3 Haiku (cost-effective for translation)
**Fallback:** Keep original language, update `translated_to: null` in metadata
**Skip if:** Document already in English (detected via Docling or first 500 chars)

### Cost Estimation

| Task                          | Model             | Tokens (avg) | Cost per doc      |
| ----------------------------- | ----------------- | ------------ | ----------------- |
| Image descriptions (×10)     | internVL (Ollama) | N/A          | $0.00             |
| Image descriptions (×10)     | Haiku fallback    | ~6,000       | ~$0.003           |
| Translation (5000 words)      | Haiku             | ~12,000      | ~$0.006           |
| **Total (Ollama path)** |                   |              | **~$0.006** |
| **Total (Haiku path)**  |                   |              | **~$0.009** |

---

## Skill Interface

### Trigger Conditions

The skill activates ONLY when the user explicitly requests document conversion:

- "Convert this PDF to markdown"
- "Process document.docx for embedding"
- "Run docling on report.pdf"
- "/docling presentation.pptx"

### Primary Command

```
/docling <file_path> [output_path]
```

### Batch Processing

When multiple files are requested, process sequentially (one at a time):

```
User: "Convert all PDFs in /docs folder"

→ Processing: report1.pdf (1/5)...
→ Completed: report1.converted.md
→ Processing: report2.pdf (2/5)...
→ Completed: report2.converted.md
[...]
```

### Options (via natural language)

| Intent           | Example                                      |
| ---------------- | -------------------------------------------- |
| Custom output    | "Convert doc.pdf and save to /output/doc.md" |
| Force OCR        | "Convert scanned.pdf using OCR"              |
| Use VLM          | "Convert complex.pdf with vision model"      |
| Specify language | "Convert doc.pdf, original is in German"     |

---

## Technical Architecture

### Technology Stack

- **Runtime:** Bun
- **Language:** TypeScript
- **Docling Interface:** CLI wrapper (`docling` command)
- **Image Processing:** Sharp (compression + base64)
- **LLM Client:** Ollama SDK + Anthropic SDK

### Dependencies

```json
{
  "dependencies": {
    "sharp": "^0.33.0",
    "ollama": "^0.5.0",
    "@anthropic-ai/sdk": "^0.30.0",
    "yaml": "^2.3.0",
    "execa": "^9.0.0"
  }
}
```

System requirements:

```bash
# Python (for Docling CLI)
pip install docling>=2.67.0

# Optional: Ollama with vision model
ollama pull blaifa/InternVL3_5:4B
```

### Skill Structure (Consolidated)

```
DoclingConverter/
├── SKILL.md                      # Skill definition
├── Tools/
│   └── Convert.ts                # SINGLE consolidated tool
├── Workflows/
│   ├── Convert.md                # Single file workflow
│   └── BatchConvert.md           # Batch workflow (sequential)
├── Lib/
│   ├── DoclingClient.ts          # Docling CLI wrapper
│   ├── ImageProcessor.ts         # Sharp compression (internal)
│   ├── DescriptionGenerator.ts   # LLM image descriptions (internal)
│   ├── Translator.ts             # LLM translation (internal)
│   ├── MetadataBuilder.ts        # Frontmatter assembly (internal)
│   └── Types.ts                  # Shared types
└── Templates/
    └── FrontmatterSchema.yaml    # Metadata template
```

**Note:** Only `Convert.ts` is the agent-facing tool. All `Lib/` modules are internal implementation details, not exposed as separate tools.

### Processing Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                 Convert.ts (Single Tool)                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. VALIDATE                                                │
│     └─ Check file exists, format supported                  │
│                                                             │
│  2. DETECT MODELS                                           │
│     ├─ Check Ollama for internVL3_5:4B                      │
│     └─ Check Anthropic API key availability                 │
│                                                             │
│  3. CONVERT (Docling CLI)                                   │
│     └─ $ docling {input} --output {temp} --export json      │
│                                                             │
│  4. EXTRACT & PROCESS IMAGES (parallel)                     │
│     ├─ Compress with Sharp (max 1200px, 80% quality)        │
│     ├─ Convert to base64                                    │
│     └─ Generate descriptions (LLM: internVL → Haiku → skip) │
│                                                             │
│  5. DETECT LANGUAGE                                         │
│     └─ Check if translation needed (source != English)      │
│                                                             │
│  6. TRANSLATE (if needed)                                   │
│     └─ LLM call: Claude Haiku                               │
│     └─ Fallback: keep original, note in metadata            │
│                                                             │
│  7. BUILD METADATA                                          │
│     └─ Compute all frontmatter fields                       │
│                                                             │
│  8. ASSEMBLE MARKDOWN                                       │
│     └─ Frontmatter + content + images + descriptions        │
│                                                             │
│  9. WRITE OUTPUT                                            │
│     └─ {input_name}.converted.md                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### State Management (Batch Mode)

For batch processing, intermediate files enable resume and debugging:

```
.docling-work/
└── {job-id}/
    ├── manifest.json              # Job state: files, progress
    ├── {file-hash}/
    │   ├── input.symlink          # Link to original
    │   ├── docling-raw.json       # Docling output
    │   ├── images/
    │   │   ├── 001.original.png
    │   │   ├── 001.compressed.jpg
    │   │   └── 001.description.txt
    │   ├── translated.md          # Post-translation (if needed)
    │   └── final.converted.md     # Output
    └── errors.log                 # Any failures
```

**Resume logic:** Check `manifest.json` for incomplete files, skip completed ones.

---

## Image Processing Specification

### Compression

| Parameter        | Value                                         |
| ---------------- | --------------------------------------------- |
| Max width        | 1200px (aspect ratio preserved)               |
| JPEG quality     | 80%                                           |
| Format selection | JPEG for photos, PNG for diagrams/screenshots |
| Target reduction | 70-80% file size                              |

### Description Prompt

```
You are analyzing an image extracted from a document.

Context:
- Document title: {title}
- Current section: {heading_path}
- Surrounding text: {context_snippet}

Describe this image in 2-3 sentences. Focus on:
1. What the image shows (diagram, photo, chart, etc.)
2. Key information it conveys
3. Its relevance to the surrounding content

Write the description to enable semantic search - someone should be able to find this image by searching for concepts it illustrates.
```

### Output Format

```markdown
![Image {n}](data:image/jpeg;base64,{base64_data})

> **Image Description:** {generated_description}
```

If description skipped:

```markdown
![Image {n}](data:image/jpeg;base64,{base64_data})

> **Image Description:** [No description available - vision model unavailable]
```

---

## Error Handling

| Error                     | Behavior                   | Metadata Flag                                 |
| ------------------------- | -------------------------- | --------------------------------------------- |
| Unsupported format        | Clear error, skip in batch | N/A                                           |
| Docling failure           | Log error, skip file       | `conversion_error: true`                    |
| OCR failure               | Fallback to text-only      | `ocr_fallback: true`                        |
| Image compression failure | Embed original             | `compression_failed: [indices]`             |
| Ollama unavailable        | Try Haiku                  | `image_description_model: "claude-3-haiku"` |
| Haiku unavailable         | Skip descriptions          | `image_description_model: "skipped"`        |
| Translation failure       | Keep original              | `translated_to: null`                       |
| File not found            | Clear error                | N/A                                           |

---

## Success Criteria

1. **Format Support** - Converts all listed input formats
2. **Structure Preservation** - Tables, code blocks, formulas render correctly
3. **Image Quality** - Compressed images remain readable
4. **Image Compression** - 70-80% average size reduction
5. **Image Descriptions** - Contextually accurate when model available
6. **Fallback Chain** - Graceful degradation: internVL → Haiku → skip
7. **Translation** - Accurate English output when applicable
8. **Metadata Completeness** - All frontmatter fields populated
9. **Performance** - 50-page PDF in under 90 seconds (excluding LLM calls)
10. **Batch Reliability** - Sequential processing with resume capability

---

## Non-Goals (v2.0)

- Chunking (downstream pipeline responsibility)
- Direct vector database insertion
- Real-time streaming conversion
- Web UI interface
- Multi-document linking
- Custom translation models
- Training or fine-tuning vision models

---

## Approval Checklist

- [X] Single consolidated tool (Convert.ts)
- [X] LLM calls explicitly specified (internVL → Haiku → skip)
- [X] Docling interface: CLI wrapper
- [X] Translation mechanism: Haiku with fallback
- [X] File-based state for batch jobs
- [X] Cost estimation included
- [X] **Final approval by Marcello**

---

**Decisions Made:**

- No chunking (downstream responsibility)
- Images: compressed + base64 + contextual descriptions
- Image model fallback: internVL (Ollama) → Haiku → skip
- Output: same directory as input (unless specified)
- Language: TypeScript (PAI standard)
- Translation: Haiku, skip if unavailable
- Batch: sequential with file-based state for resume
- Single tool architecture per consolidation principle

**Next Steps:** Upon approval, implement skill following TitleCase conventions.
