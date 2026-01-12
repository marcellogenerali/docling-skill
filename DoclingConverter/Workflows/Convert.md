# Convert Workflow

**Triggered when:** User requests single document conversion.

## Pre-Execution

### 1. Validate Input

- File exists and is accessible
- Format is supported (PDF, DOCX, PPTX, XLSX, HTML, MD, PNG, JPG, TIFF, WAV, MP3, VTT)

### 2. Parse User Intent

Extract from user request:

| Variable | Source | Default |
|----------|--------|---------|
| `INPUT_PATH` | File path in request | Required |
| `OUTPUT_PATH` | "save to", "output to" | Same directory |
| `OCR_FLAG` | "OCR", "scanned" | false |
| `VLM_FLAG` | "VLM", "vision model" | false |
| `LANGUAGE` | "in German", "French document" | Auto-detect |

## Execution

Run the Convert tool:

```bash
bun run $PAI_DIR/skills/DoclingConverter/Tools/Convert.ts {INPUT_PATH} [options]
```

**Options mapping:**

| User Intent | CLI Option |
|-------------|------------|
| Custom output path | `--output {path}` |
| OCR processing | `--ocr` |
| VLM pipeline | `--vlm` |
| Source language | `--lang {code}` |

## Pipeline Steps

1. **VALIDATE** - Check file exists, format supported
2. **DETECT MODELS** - Check Ollama (internVL3_5:4B), then Anthropic API
3. **CONVERT** - Run Docling CLI
4. **PROCESS IMAGES** - Compress with Sharp, generate descriptions
5. **DETECT LANGUAGE** - Check if translation needed
6. **TRANSLATE** - Use Claude Haiku if not English
7. **BUILD METADATA** - Generate YAML frontmatter
8. **ASSEMBLE** - Combine frontmatter + content + images
9. **WRITE** - Save to `{name}.converted.md`

## Output Format

```
📋 SUMMARY: Converted {filename} to embedding-ready markdown
🔍 ANALYSIS:
  - Format: {format}
  - Pages: {count}
  - Images: {count} ({described} described)
  - Language: {source} → {target}
⚡ ACTIONS:
  - Docling conversion: {time}ms
  - Image processing: {time}ms
  - Translation: {time}ms
✅ RESULTS:
  - Output: {output_path}
  - Size: {size}KB
➡️ NEXT:
  1. Review converted document
  2. Verify image descriptions
  3. Process with chunking pipeline
🗣️ romeo: Document converted, {n} images processed.
```

## Error Handling

| Error | Behavior | User Message |
|-------|----------|--------------|
| File not found | Abort | "File not found: {path}" |
| Unsupported format | Abort | "Unsupported format: {ext}. Supported: PDF, DOCX, PPTX, XLSX, HTML, MD, images, audio, VTT" |
| Docling not installed | Abort | "Docling CLI not found. Install with: pip install docling>=2.67.0" |
| Docling failed | Abort | "Conversion failed: {error}" |
| Image processing failed | Continue | Images embedded without compression |
| Ollama unavailable | Fallback | Uses Claude Haiku for descriptions |
| Haiku unavailable | Skip | Placeholder: "[No description available]" |
| Translation failed | Continue | Keep original language, note in metadata |

## Examples

**Basic conversion:**
```
User: "Convert report.pdf"
-> bun run Convert.ts report.pdf
-> Output: report.converted.md
```

**Custom output:**
```
User: "Convert doc.pdf and save to /output/doc.md"
-> bun run Convert.ts doc.pdf --output /output/doc.md
```

**OCR for scanned document:**
```
User: "Convert scanned.pdf using OCR"
-> bun run Convert.ts scanned.pdf --ocr
```

**German document:**
```
User: "Convert german_report.pdf, it's in German"
-> bun run Convert.ts german_report.pdf --lang de
```
