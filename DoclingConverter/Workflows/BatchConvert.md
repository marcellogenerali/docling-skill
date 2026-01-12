# BatchConvert Workflow

**Triggered when:** User requests conversion of multiple documents or a directory.

## Pre-Execution

### 1. Validate Input

- Directory exists and is accessible
- Contains at least one supported file
- No active conversion in progress (unless resuming)

### 2. Parse User Intent

Extract from user request:

| Variable | Source | Default |
|----------|--------|---------|
| `INPUT_DIR` | Directory path | Required |
| `FILE_PATTERN` | "all PDFs", "only docx" | All supported |
| `RESUME` | "resume", "continue" | false |
| `OCR_FLAG` | "with OCR" | false |

## Execution

Run the Convert tool in batch mode:

```bash
bun run $PAI_DIR/skills/DoclingConverter/Tools/Convert.ts --batch {INPUT_DIR} [options]
```

**Options:**

| User Intent | CLI Option |
|-------------|------------|
| Resume previous | `--resume` |
| OCR processing | `--ocr` |
| VLM pipeline | `--vlm` |

## Processing Flow

```
1. Scan directory for supported files
2. Create/load manifest in .docling-work/
3. For each file (sequential):
   a. Update manifest: status = "processing"
   b. Run single file conversion
   c. Update manifest: status = "completed" or "failed"
   d. Report progress
4. Print summary
5. Clean up .docling-work/ on success
```

## State Management

Work directory structure:

```
{input_dir}/
├── .docling-work/
│   └── manifest.json     # Job state
├── document1.pdf
├── document1.converted.md  # Output
├── document2.docx
└── document2.converted.md  # Output
```

**Manifest schema:**

```json
{
  "jobId": "a1b2c3d4",
  "createdAt": "2026-01-12T10:00:00Z",
  "updatedAt": "2026-01-12T10:30:00Z",
  "inputDirectory": "/path/to/docs",
  "totalFiles": 10,
  "completedFiles": 7,
  "failedFiles": 1,
  "files": [
    {
      "path": "/path/to/docs/report.pdf",
      "hash": "abc123",
      "status": "completed",
      "outputPath": "/path/to/docs/report.converted.md",
      "processingTime": 5420
    }
  ]
}
```

## Progress Reporting

```
Batch conversion: 10 files

[1/10] report.pdf
  Converting: report.pdf
  Detecting available models...
    Image model: blaifa/InternVL3_5:4B
  Running Docling conversion...
    Docling completed in 3200ms
  Processing images...
    Processed 5 images (5 described) in 1200ms
  Detecting language...
    Detected: en
  Building metadata...

[2/10] presentation.pptx
  ...

==================================================
Batch complete: 9 succeeded, 1 failed
==================================================
```

## Resume Capability

When `--resume` is used:

1. Load existing manifest from `.docling-work/`
2. Skip files with `status: "completed"`
3. Retry files with `status: "failed"` or `status: "processing"`
4. Continue from where interrupted

## Output Format

```
📋 SUMMARY: Batch converted {completed}/{total} documents
🔍 ANALYSIS:
  - Directory: {input_dir}
  - Succeeded: {count}
  - Failed: {count}
  - Total time: {time}
⚡ ACTIONS:
  - Created {count} markdown files
  - Processed {count} images total
  - Translated {count} documents
✅ RESULTS:
  - All outputs in source directory
  - Work directory: {cleaned up | preserved for resume}
➡️ NEXT:
  1. Review failed conversions (if any)
  2. Process outputs with chunking pipeline
  3. Ingest into vector database
🗣️ romeo: Batch complete, {succeeded} of {total} converted.
```

## Error Handling

| Error | Behavior | Recovery |
|-------|----------|----------|
| Directory not found | Abort | Check path |
| No supported files | Abort | Check file types |
| Single file fails | Continue | Log error, proceed to next |
| Interruption | Preserve state | Use `--resume` to continue |
| All files fail | Preserve state | Check Docling installation |

## Examples

**Convert all files in directory:**
```
User: "Convert all documents in /docs/reports/"
-> bun run Convert.ts --batch /docs/reports/
```

**Resume interrupted batch:**
```
User: "Resume the batch conversion"
-> bun run Convert.ts --batch /docs/reports/ --resume
```

**Batch with OCR:**
```
User: "Convert all scanned PDFs in /archive/ using OCR"
-> bun run Convert.ts --batch /archive/ --ocr
```
