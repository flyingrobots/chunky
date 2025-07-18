# 🔪 Chunky

A high-performance streaming text file chunker with proper async handling and memory efficiency.

## Overview

Chunky splits large text files into smaller chunks based on word count using Node.js streams. It handles backpressure correctly, tracks memory usage, and provides detailed progress reporting.

## Features

- **Stream-based processing** - Handles files of any size without loading into memory
- **Proper async handling** - Uses promisified stream utilities for reliable operation  
- **Memory tracking** - Monitor memory usage and high water marks during processing
- **Zero-padded naming** - Chunks named with 4-digit zero padding (chunk_0001.txt)
- **Progress reporting** - Real-time progress bars and statistics
- **Error resilience** - Continues processing if file stats fail
- **TypeScript** - Full type safety with Zod validation

## Installation

```bash
# Clone and install
git clone https://github.com/flyingrobots/chunky.git
cd chunky
pnpm install

# Build everything including CLI
pnpm run build

# Run tests
pnpm test
```

### Global CLI Installation

```bash
# After building, install globally
pnpm link --global

# Now use anywhere
chunky large-file.txt --words 5000
```

## CLI Usage

```bash
# Basic usage - splits into 1000-word chunks
chunky document.txt

# Custom word count
chunky document.txt --words 500

# Multiple files with options
chunky *.txt --words 2000 --out-dir ./output --stem part

# All options
chunky input.txt \
  --words 1000 \       # Words per chunk
  --out-dir ./chunks \ # Output directory
  --stem chunk \       # File name prefix
  --ext .txt \         # File extension
  --delimiter "\\s+"   # Word delimiter regex
```

## API Usage

```typescript
import { chunkStream } from 'chunky';
import fs from 'node:fs';

// Basic streaming
const stream = fs.createReadStream('large-file.txt', { encoding: 'utf8' });
await chunkStream(stream, {
  wordsPerChunk: 1000,
  outDir: './output'
});

// With progress callbacks
await chunkStream(stream, {
  wordsPerChunk: 500,
  onProgress: (wordCount) => console.log(`${wordCount} words`),
  onStats: (stats) => console.log(`Memory: ${stats.currentMemoryUsage}`)
});
```

## How It Works

1. **Tokenization** - Input stream is tokenized using the delimiter pattern
2. **Immediate writing** - Words are written to output files as soon as they're tokenized (no buffering)
3. **File rotation** - New output files are created when word count reaches chunk size
4. **Async cleanup** - Streams are properly closed using promisified utilities
5. **Memory tracking** - Stats callbacks report memory usage throughout

## Output Format

Files are created with zero-padded sequential numbering:

```
chunks/
├── chunk_0001.txt    # First chunk
├── chunk_0002.txt    # Second chunk
├── chunk_0003.txt    # Third chunk
└── chunk_0004.txt    # Fourth chunk
```

## Performance

- Processes files of any size without memory constraints
- No word buffering - writes immediately to disk (crash-safe)
- Handles backpressure automatically
- Tracks high water mark for memory usage analysis
- Cleans up promise arrays to prevent memory leaks

## Development

```bash
# Run tests
pnpm test

# Run with coverage
pnpm test:coverage

# Lint code
pnpm lint

# Build project
pnpm build

# Build CLI only
pnpm build:cli
```

## Architecture

- `ChunkStream` - Main transform stream handling the chunking logic
- `WordTokenizer` - Transform stream that tokenizes input by delimiter
- `StatsTracker` - Tracks processing statistics across files
- Proper async/await with `promisify(finished)` for stream completion
- Memory-efficient promise array cleanup

## License

MIND-UCLA-1.0