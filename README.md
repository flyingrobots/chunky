# 🔪 Chunky

> A powerful CLI tool for splitting text files into word-based chunks

## What is Chunky?

Chunky is a TypeScript CLI tool that processes text files and splits them into smaller chunks based on word count. Perfect for breaking large documents, logs, or datasets into manageable pieces for processing, analysis, or storage.

## Features

- **📊 Word-Based Chunking**: Split files by word count, not arbitrary byte sizes
- **🎯 Smart Tokenization**: Configurable delimiters for different file types
- **📁 Flexible Output**: Customize output directory, file names, and extensions
- **⚡ Stream Processing**: Memory-efficient streaming for large files
- **📈 Rich Progress**: Real-time progress bars and detailed statistics
- **🔧 Developer-Friendly**: Clean TypeScript API with Zod validation
- **🚀 High Performance**: Concurrent processing with proper error handling

## Installation

```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build

# Run tests
pnpm run test
```

## CLI Usage

```bash
# Basic usage - chunk a file into 1000-word pieces
chunky document.txt

# Custom word count and output directory
chunky document.txt --words 500 --out-dir ./output

# Multiple files with custom settings
chunky file1.txt file2.txt --words 750 --stem "part" --ext ".md"

# Custom delimiter for CSV files
chunky data.csv --delimiter "," --words 100

# All options
chunky input.txt \
  --words 1000 \           # Words per chunk (default: 1000)
  --out-dir ./chunks \     # Output directory (default: ./chunks)  
  --stem chunk \           # File stem (default: chunk)
  --ext .txt \             # File extension (default: .txt)
  --delimiter "\\s+" \     # Word delimiter regex (default: \s+)
```

## API Usage

```typescript
import { chunkStream } from './src/index.js';
import { ChunkOptions } from './src/ChunkOptions.js';
import fs from 'node:fs';

// Basic streaming API
const stream = fs.createReadStream('large-file.txt', { encoding: 'utf8' });
await chunkStream(stream, {
  wordsPerChunk: 1000,
  outDir: './output',
  fileStem: 'chunk',
  fileExt: '.txt'
});

// With callbacks for monitoring
await chunkStream(stream, {
  wordsPerChunk: 500,
  outDir: './chunks',
  onStreamOpen: (path) => console.log(`Started chunk: ${path}`),
  onStreamClose: (path) => console.log(`Completed chunk: ${path}`),
  onProgress: (wordCount) => console.log(`Processed ${wordCount} words`)
});

// Custom delimiter for different file types
await chunkStream(csvStream, {
  delimiter: /,/,  // Split on commas for CSV
  wordsPerChunk: 100,
  fileExt: '.csv'
});
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `wordsPerChunk` | number | 1000 | Number of words per chunk |
| `delimiter` | RegExp | `/\s+/` | Pattern to split words on |
| `outDir` | string | `"./chunks"` | Output directory for chunks |
| `fileStem` | string | `"chunk"` | Base name for chunk files |
| `fileExt` | string | `".txt"` | File extension for chunks |
| `encoding` | BufferEncoding | `"utf8"` | Text encoding |
| `onStreamOpen` | function | - | Callback when chunk file opens |
| `onStreamClose` | function | - | Callback when chunk file closes |
| `onProgress` | function | - | Callback for progress updates |

## Output

Chunky creates numbered files in the specified output directory:

```
chunks/
├── chunk_0.txt    # First 1000 words
├── chunk_1.txt    # Next 1000 words  
├── chunk_2.txt    # Next 1000 words
└── chunk_3.txt    # Remaining words
```

## Use Cases

- **Large Document Processing**: Split books, articles, or reports for analysis
- **Log File Analysis**: Break log files into time-based or size-based chunks
- **Data Pipeline**: Prepare large datasets for batch processing
- **Content Management**: Divide content for pagination or storage limits
- **NLP Preprocessing**: Create training data chunks for machine learning

## Development

```bash
# Run in development mode
pnpm run dev

# Run linting
pnpm run lint

# Build for production
pnpm run build

# Run specific tests
pnpm test -- ChunkStream
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Make your changes with tests
4. Run the test suite (`pnpm test`)
5. Commit your changes (`git commit -m 'feat: add amazing feature'`)
6. Push to the branch (`git push origin feat/amazing-feature`)
7. Open a Pull Request

## License

MIND-UCLA-1.0

---

*Built with TypeScript, tested with Vitest, and validated with Zod. 🔪*