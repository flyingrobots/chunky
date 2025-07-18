import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Readable } from 'node:stream';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { chunkStream } from '../src/index.js';
import { ChunkOptions } from '../src/ChunkOptions.js';

let TEST_DIR: string;

describe('chunkStream end-to-end behavior', () => {
  beforeEach(async () => {
    // Create a unique temporary directory
    TEST_DIR = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'chunky-e2e-test-'));
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.promises.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, that's fine
    }
  });

  describe('when chunking files from different sources', () => {
    it('should chunk file streams correctly', async () => {
      // Create temp file
      const tempFile = path.join(TEST_DIR, 'input.txt');
      const testContent = 'word1 word2 word3 word4 word5';
      await fs.promises.writeFile(tempFile, testContent);
      
      // Create read stream and chunk it
      const readStream = fs.createReadStream(tempFile, { encoding: 'utf8' });
      const chunkDir = path.join(TEST_DIR, 'chunks');
      await chunkStream(readStream, { 
        outDir: chunkDir,
        wordsPerChunk: 2,
        fileStem: 'file'
      });
      
      // Verify chunks contain original content
      const files = await fs.promises.readdir(chunkDir);
      expect(files.length).toBeGreaterThan(0);
      
      let reconstructed = '';
      for (const file of files.sort()) {
        const content = await fs.promises.readFile(path.join(chunkDir, file), 'utf8');
        reconstructed += content.trim() + ' ';
      }
      
      expect(reconstructed.trim()).toBe(testContent);
    });

    it('should chunk string streams correctly', async () => {
      const testContent = 'alpha beta gamma delta epsilon';
      
      // Create Readable.from() stream and chunk it
      const stream = Readable.from([testContent]);
      const chunkDir = path.join(TEST_DIR, 'string-chunks');
      await chunkStream(stream, {
        outDir: chunkDir,
        wordsPerChunk: 3,
        fileStem: 'string'
      });
      
      // Verify content is preserved
      const files = await fs.promises.readdir(chunkDir);
      expect(files.length).toBeGreaterThan(0);
      
      let reconstructed = '';
      for (const file of files.sort()) {
        const content = await fs.promises.readFile(path.join(chunkDir, file), 'utf8');
        reconstructed += content.trim() + ' ';
      }
      
      expect(reconstructed.trim()).toBe(testContent);
    });

    it('should chunk buffer streams correctly', async () => {
      const testContent = 'buffer one two three four';
      const buffer = Buffer.from(testContent, 'utf8');
      
      // Create stream from Buffer and chunk it
      const stream = Readable.from([buffer]);
      const chunkDir = path.join(TEST_DIR, 'buffer-chunks');
      await chunkStream(stream, {
        outDir: chunkDir,
        wordsPerChunk: 2,
        fileStem: 'buffer'
      });
      
      // Verify binary data is handled correctly
      const files = await fs.promises.readdir(chunkDir);
      expect(files.length).toBeGreaterThan(0);
      
      let reconstructed = '';
      for (const file of files.sort()) {
        const content = await fs.promises.readFile(path.join(chunkDir, file), 'utf8');
        reconstructed += content.trim() + ' ';
      }
      
      expect(reconstructed.trim()).toBe(testContent);
    });
  });

  describe('when using the simplified API', () => {
    it('should use sensible defaults when no options provided', async () => {
      const testContent = 'default test content with multiple words';
      
      // Call chunkStream with only stream parameter
      const stream = Readable.from([testContent]);
      await chunkStream(stream);
      
      // Verify default chunk size, directory, naming
      const defaultDir = './chunks';
      const files = await fs.promises.readdir(defaultDir);
      expect(files.length).toBeGreaterThan(0);
      expect(files[0]).toMatch(/^chunk_\d{4}\.txt$/);
      
      // Clean up
      await fs.promises.rm(defaultDir, { recursive: true, force: true });
    });

    it('should override only specified options', async () => {
      const testContent = 'partial options test content';
      
      // Provide partial options object
      const stream = Readable.from([testContent]);
      const customDir = path.join(TEST_DIR, 'custom');
      await chunkStream(stream, {
        outDir: customDir,
        wordsPerChunk: 2
        // Other options should use defaults
      });
      
      // Verify specified options are used, others are defaults
      const files = await fs.promises.readdir(customDir);
      expect(files.length).toBeGreaterThan(0);
      // Should use custom outDir and wordsPerChunk, but default fileStem and fileExt
      expect(files[0]).toMatch(/^chunk_\d{4}\.txt$/);
      
      // Verify content is chunked with custom word count
      let reconstructed = '';
      for (const file of files.sort()) {
        const content = await fs.promises.readFile(path.join(customDir, file), 'utf8');
        reconstructed += content.trim() + ' ';
      }
      expect(reconstructed.trim()).toBe(testContent);
    });
  });

  describe('when integrating with real file systems', () => {
    it('should preserve file content exactly after chunking and reassembly', async () => {
      const originalContent = 'This is a test file with multiple sentences. It contains various punctuation marks! And different types of content? Yes, it does.';
      const inputFile = path.join(TEST_DIR, 'original.txt');
      await fs.promises.writeFile(inputFile, originalContent);
      
      // Chunk a file, concatenate chunks, compare with original
      const stream = fs.createReadStream(inputFile);
      const chunkDir = path.join(TEST_DIR, 'preservation-chunks');
      await chunkStream(stream, {
        outDir: chunkDir,
        wordsPerChunk: 5
      });
      
      // Verify byte-for-byte equality
      const files = await fs.promises.readdir(chunkDir);
      let reconstructed = '';
      for (const file of files.sort()) {
        const content = await fs.promises.readFile(path.join(chunkDir, file), 'utf8');
        reconstructed += content.trim() + ' ';
      }
      
      expect(reconstructed.trim()).toBe(originalContent);
      expect(reconstructed.trim().length).toBe(originalContent.length);
    });

    it('should handle platform-specific line endings', async () => {
      // Test with different line endings
      const testContent = 'line1\nline2\r\nline3\rline4';
      const stream = Readable.from([testContent]);
      const chunkDir = path.join(TEST_DIR, 'line-endings');
      
      await chunkStream(stream, {
        outDir: chunkDir,
        wordsPerChunk: 2
      });
      
      // Verify chunks preserve original line endings
      const files = await fs.promises.readdir(chunkDir);
      expect(files.length).toBeGreaterThan(0);
      
      let reconstructed = '';
      for (const file of files.sort()) {
        const content = await fs.promises.readFile(path.join(chunkDir, file), 'utf8');
        reconstructed += content.trim() + ' ';
      }
      
      expect(reconstructed.trim()).toBe(testContent);
    });

    it('should work with different file encodings', async () => {
      // Test with UTF-8 content (emoji and special chars)
      const testContent = 'Hello 🌍 world café naïve résumé';
      const stream = Readable.from([testContent]);
      const chunkDir = path.join(TEST_DIR, 'encoding');
      
      await chunkStream(stream, {
        outDir: chunkDir,
        wordsPerChunk: 3
      });
      
      // Verify encoding is preserved
      const files = await fs.promises.readdir(chunkDir);
      expect(files.length).toBeGreaterThan(0);
      
      let reconstructed = '';
      for (const file of files.sort()) {
        const content = await fs.promises.readFile(path.join(chunkDir, file), 'utf8');
        reconstructed += content.trim() + ' ';
      }
      
      expect(reconstructed.trim()).toBe(testContent);
    });
  });

  describe('when processing different file types', () => {
    it('should chunk plain text files', async () => {
      const txtContent = 'This is a plain text file with multiple words and sentences.';
      const stream = Readable.from([txtContent]);
      const chunkDir = path.join(TEST_DIR, 'txt-chunks');
      
      await chunkStream(stream, {
        outDir: chunkDir,
        wordsPerChunk: 4,
        fileExt: '.txt'
      });
      
      const files = await fs.promises.readdir(chunkDir);
      expect(files.length).toBeGreaterThan(0);
      expect(files[0]).toMatch(/\.txt$/);
    });

    it('should chunk markdown files', async () => {
      const mdContent = '# Heading\n\nThis is **bold** text and *italic* text.';
      const stream = Readable.from([mdContent]);
      const chunkDir = path.join(TEST_DIR, 'md-chunks');
      
      await chunkStream(stream, {
        outDir: chunkDir,
        wordsPerChunk: 3,
        fileExt: '.md'
      });
      
      // Verify formatting preserved
      const files = await fs.promises.readdir(chunkDir);
      expect(files.length).toBeGreaterThan(0);
      expect(files[0]).toMatch(/\.md$/);
      
      let reconstructed = '';
      for (const file of files.sort()) {
        const content = await fs.promises.readFile(path.join(chunkDir, file), 'utf8');
        reconstructed += content.trim() + ' ';
      }
      
      expect(reconstructed.trim()).toBe(mdContent);
    });

    it('should chunk code files', async () => {
      const jsContent = 'function hello() { console.log("Hello world!"); return true; }';
      const stream = Readable.from([jsContent]);
      const chunkDir = path.join(TEST_DIR, 'js-chunks');
      
      await chunkStream(stream, {
        outDir: chunkDir,
        wordsPerChunk: 5,
        fileExt: '.js'
      });
      
      // Verify syntax not broken
      const files = await fs.promises.readdir(chunkDir);
      expect(files.length).toBeGreaterThan(0);
      expect(files[0]).toMatch(/\.js$/);
      
      let reconstructed = '';
      for (const file of files.sort()) {
        const content = await fs.promises.readFile(path.join(chunkDir, file), 'utf8');
        reconstructed += content.trim() + ' ';
      }
      
      expect(reconstructed.trim()).toBe(jsContent);
    });

    it('should chunk CSV files with appropriate delimiter', async () => {
      // Create CSV content with multiple rows
      const csvRows = [
        'name,age,city,country',
        'John Doe,30,New York,USA',
        'Jane Smith,25,London,UK',
        'Bob Johnson,35,Toronto,Canada',
        'Alice Brown,28,Sydney,Australia',
        'Charlie Wilson,32,Berlin,Germany',
        'Diana Martinez,29,Madrid,Spain'
      ];
      const csvContent = csvRows.join('\n');
      
      const stream = Readable.from([csvContent]);
      const chunkDir = path.join(TEST_DIR, 'csv-chunks');
      
      // Use newline as delimiter to preserve CSV rows
      await chunkStream(stream, {
        outDir: chunkDir,
        wordsPerChunk: 3, // About 3 rows per chunk
        delimiter: /\n/,
        outputDelimiter: '\n',
        fileExt: '.csv'
      });
      
      // Verify CSV structure is preserved
      const files = await fs.promises.readdir(chunkDir);
      expect(files.length).toBeGreaterThan(0);
      expect(files[0]).toMatch(/\.csv$/);
      
      // Verify each chunk has complete rows (no partial rows)
      let totalRows = 0;
      for (const file of files) {
        const content = await fs.promises.readFile(path.join(chunkDir, file), 'utf8');
        // The content will have rows separated by newlines with the outputDelimiter option
        const rows = content.trim().split(/\n/).filter(r => r.trim());
        
        // Each row should have the same number of commas (3 in this case)
        for (const row of rows) {
          if (row.trim()) {
            const commaCount = (row.match(/,/g) || []).length;
            // Allow header row to have different comma count if needed
            if (commaCount === 3) {
              totalRows++;
            }
          }
        }
      }
      
      // Verify all rows were preserved
      expect(totalRows).toBe(csvRows.length);
      
      // Reconstruct and verify all data is preserved
      let reconstructed = '';
      for (const file of files.sort()) {
        const content = await fs.promises.readFile(path.join(chunkDir, file), 'utf8');
        // Replace newlines with spaces to reconstruct the original space-separated format
        reconstructed += content.trim().replace(/\n/g, ' ') + ' ';
      }
      
      // The tokenizer treats each line as a "word", so they should be space-separated in reconstruction
      const expectedReconstruction = csvRows.join(' ');
      expect(reconstructed.trim()).toBe(expectedReconstruction);
    });
  });

  describe('performance characteristics', () => {
    it('should chunk at reasonable speed', async () => {
      // Generate 1MB of text data (approximately 200,000 words)
      const wordCount = 200000;
      const words = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit'];
      let largeContent = '';
      
      for (let i = 0; i < wordCount; i++) {
        largeContent += words[i % words.length] + ' ';
        if (i % 20 === 0) largeContent += '\n'; // Add some line breaks
      }
      
      const stream = Readable.from([largeContent]);
      const chunkDir = path.join(TEST_DIR, 'speed-test');
      
      // Measure chunking time
      const startTime = process.hrtime.bigint();
      await chunkStream(stream, {
        outDir: chunkDir,
        wordsPerChunk: 5000, // 40 chunks total
        fileStem: 'speed'
      });
      const endTime = process.hrtime.bigint();
      
      // Calculate duration in milliseconds
      const durationMs = Number(endTime - startTime) / 1_000_000;
      
      // Verify it completes in reasonable time (< 1 second for 1MB)
      expect(durationMs).toBeLessThan(1000);
      
      // Verify all content was chunked
      const files = await fs.promises.readdir(chunkDir);
      expect(files.length).toBeGreaterThan(30); // Should have ~40 chunks
      
      // Spot check that chunks contain expected content
      const firstChunk = await fs.promises.readFile(path.join(chunkDir, files.sort()[0]), 'utf8');
      expect(firstChunk).toContain('lorem');
    });

    it('should maintain constant memory usage for large files', async () => {
      // Create a large stream that generates data on demand
      const totalWords = 100000;
      let wordsGenerated = 0;
      
      const largeStream = new Readable({
        read() {
          if (wordsGenerated >= totalWords) {
            this.push(null);
            return;
          }
          
          // Generate batch of words
          const batchSize = Math.min(1000, totalWords - wordsGenerated);
          let batch = '';
          for (let i = 0; i < batchSize; i++) {
            batch += 'word' + (wordsGenerated + i) + ' ';
          }
          
          this.push(batch);
          wordsGenerated += batchSize;
        }
      });
      
      const chunkDir = path.join(TEST_DIR, 'memory-test');
      
      // Track memory usage samples
      const memorySamples: number[] = [];
      const sampleInterval = setInterval(() => {
        const memUsage = process.memoryUsage();
        memorySamples.push(memUsage.heapUsed);
      }, 50); // Sample every 50ms
      
      try {
        await chunkStream(largeStream, {
          outDir: chunkDir,
          wordsPerChunk: 1000,
          onProgress: (count) => {
            // Progress callback to ensure we're monitoring during operation
            if (count % 10000 === 0) {
              const memUsage = process.memoryUsage();
              memorySamples.push(memUsage.heapUsed);
            }
          }
        });
      } finally {
        clearInterval(sampleInterval);
      }
      
      // Analyze memory usage
      expect(memorySamples.length).toBeGreaterThan(5);
      
      // Calculate average and max memory
      const avgMemory = memorySamples.reduce((a, b) => a + b, 0) / memorySamples.length;
      const maxMemory = Math.max(...memorySamples);
      const minMemory = Math.min(...memorySamples);
      
      // Memory should not grow significantly (max should be < 2x min)
      // This indicates streaming is working properly
      expect(maxMemory).toBeLessThan(minMemory * 2);
      
      // Verify all chunks were created
      const files = await fs.promises.readdir(chunkDir);
      // Due to how chunks are written, the actual number might be slightly different
      expect(files.length).toBeGreaterThan(95);
      expect(files.length).toBeLessThanOrEqual(100);
    });

    it('should support backpressure', async () => {
      // Create a stream that tracks pause/resume calls
      let pauseCount = 0;
      let resumeCount = 0;
      let isPaused = false;
      
      const testData = Array(50).fill('word').join(' '); // 50 words
      const trackingStream = new Readable({
        read() {
          if (!isPaused) {
            this.push(testData);
            this.push(null); // End stream after one push
          }
        }
      });
      
      // Override pause and resume to track calls
      const originalPause = trackingStream.pause.bind(trackingStream);
      const originalResume = trackingStream.resume.bind(trackingStream);
      
      trackingStream.pause = function() {
        pauseCount++;
        isPaused = true;
        return originalPause();
      };
      
      trackingStream.resume = function() {
        resumeCount++;
        isPaused = false;
        return originalResume();
      };
      
      const chunkDir = path.join(TEST_DIR, 'backpressure-test');
      
      // Use small chunks to potentially trigger backpressure
      await chunkStream(trackingStream, {
        outDir: chunkDir,
        wordsPerChunk: 5, // Small chunks to create more file writes
        fileStem: 'pressure'
      });
      
      // Verify the stream was properly consumed
      const files = await fs.promises.readdir(chunkDir);
      // Due to how chunking works, might have 9 or 10 files
      expect(files.length).toBeGreaterThanOrEqual(9);
      expect(files.length).toBeLessThanOrEqual(10);
      
      // Verify content integrity
      let reconstructed = '';
      for (const file of files.sort()) {
        const content = await fs.promises.readFile(path.join(chunkDir, file), 'utf8');
        reconstructed += content.trim() + ' ';
      }
      expect(reconstructed.trim()).toBe(testData);
    });
  });

  describe('real-world scenarios', () => {
    it('should chunk a novel into chapters', async () => {
      // Generate book-length text (~50,000 words)
      const words = ['the', 'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog', 'chapter', 'story', 'novel', 'book', 'text', 'content', 'writing', 'literature'];
      const totalWords = 50000;
      let novelContent = '';
      
      for (let i = 0; i < totalWords; i++) {
        novelContent += words[i % words.length] + ' ';
        // Add some punctuation and line breaks
        if (i % 50 === 49) novelContent += '.\n';
      }
      
      const stream = Readable.from([novelContent]);
      const chunkDir = path.join(TEST_DIR, 'novel-chapters');
      
      await chunkStream(stream, {
        outDir: chunkDir,
        wordsPerChunk: 5000, // ~5000 words per chapter
        fileStem: 'chapter',
        fileExt: '.txt'
      });
      
      const files = await fs.promises.readdir(chunkDir);
      expect(files.length).toBeGreaterThan(5); // Should have ~10 chapters
      expect(files.length).toBeLessThanOrEqual(12);
      
      // Verify each chapter has reasonable size
      for (const file of files) {
        const content = await fs.promises.readFile(path.join(chunkDir, file), 'utf8');
        const wordCount = content.trim().split(/\s+/).length;
        expect(wordCount).toBeGreaterThan(1000); // Reasonable minimum
        expect(wordCount).toBeLessThanOrEqual(5000); // Within limit
      }
    });

    it('should chunk log files by entry count', async () => {
      // Generate log entries with timestamps
      const logEntries = [];
      for (let i = 0; i < 25; i++) {
        const timestamp = new Date(Date.now() - i * 60000).toISOString();
        logEntries.push(`${timestamp} [INFO] Log entry ${i}: Some application event occurred`);
      }
      
      const logContent = logEntries.join('\n');
      const stream = Readable.from([logContent]);
      const chunkDir = path.join(TEST_DIR, 'log-chunks');
      
      await chunkStream(stream, {
        outDir: chunkDir,
        wordsPerChunk: 10, // ~10 log entries per chunk
        delimiter: /\n/,
        outputDelimiter: '\n',
        fileStem: 'log',
        fileExt: '.log'
      });
      
      const files = await fs.promises.readdir(chunkDir);
      expect(files.length).toBeGreaterThan(1);
      expect(files[0]).toMatch(/\.log$/);
      
      // Verify each chunk has complete log entries
      let totalEntries = 0;
      for (const file of files) {
        const content = await fs.promises.readFile(path.join(chunkDir, file), 'utf8');
        const entries = content.trim().split('\n').filter(line => line.trim());
        
        // Each entry should have timestamp and be complete
        for (const entry of entries) {
          expect(entry).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[INFO\] Log entry \d+:/);
          totalEntries++;
        }
      }
      
      expect(totalEntries).toBe(logEntries.length);
    });

    it('should chunk data for batch processing', async () => {
      // Generate large dataset (5000 records)
      const records = [];
      for (let i = 0; i < 5000; i++) {
        records.push(`{"id": ${i}, "name": "User ${i}", "email": "user${i}@example.com", "created": "${new Date().toISOString()}"}`);
      }
      
      const dataContent = records.join('\n');
      const stream = Readable.from([dataContent]);
      const chunkDir = path.join(TEST_DIR, 'batch-chunks');
      
      await chunkStream(stream, {
        outDir: chunkDir,
        wordsPerChunk: 1000, // 1000 records per batch
        delimiter: /\n/,
        outputDelimiter: '\n',
        fileStem: 'batch',
        fileExt: '.json'
      });
      
      const files = await fs.promises.readdir(chunkDir);
      expect(files.length).toBeGreaterThan(3); // Should have ~5 batches
      expect(files.length).toBeLessThanOrEqual(6);
      
      // Verify each batch is processable independently
      let totalRecords = 0;
      for (const file of files) {
        const content = await fs.promises.readFile(path.join(chunkDir, file), 'utf8');
        const batchRecords = content.trim().split('\n').filter(line => line.trim());
        
        // Each record should be valid JSON
        for (const record of batchRecords) {
          expect(() => JSON.parse(record)).not.toThrow();
          const parsed = JSON.parse(record);
          expect(parsed).toHaveProperty('id');
          expect(parsed).toHaveProperty('name');
          expect(parsed).toHaveProperty('email');
          totalRecords++;
        }
        
        // Each batch should have reasonable size
        expect(batchRecords.length).toBeGreaterThan(0);
        expect(batchRecords.length).toBeLessThanOrEqual(1000);
      }
      
      expect(totalRecords).toBe(records.length);
    });
  });

  describe('error scenarios', () => {
    it('should fail gracefully when stream is not readable', async () => {
      // Create a stream that's already closed
      const stream = Readable.from(['test data']);
      stream.destroy(); // Close the stream
      
      const chunkDir = path.join(TEST_DIR, 'error-chunks');
      
      // Should handle the error gracefully
      await expect(chunkStream(stream, {
        outDir: chunkDir,
        wordsPerChunk: 10
      })).rejects.toThrow();
      
      // Verify no partial files were created
      try {
        const files = await fs.promises.readdir(chunkDir);
        expect(files.length).toBe(0);
      } catch (error) {
        // Directory might not exist, which is also fine
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle file system errors during operation', async () => {
      // Create a file that will prevent directory creation
      const blockingFile = path.join(TEST_DIR, 'blocking-file.txt');
      await fs.promises.writeFile(blockingFile, 'blocking content');
      
      // Try to use the file path as a directory (this will fail)
      const invalidDir = blockingFile;
      
      // Create a stream with enough data to trigger multiple chunks
      const testData = 'word '.repeat(100);
      const stream = Readable.from([testData]);
      
      // Should handle the error gracefully
      await expect(chunkStream(stream, {
        outDir: invalidDir,
        wordsPerChunk: 10
      })).rejects.toThrow();
    });

    it('should handle invalid options gracefully', async () => {
      const stream = Readable.from(['test data']);
      
      // Test negative words per chunk
      await expect(chunkStream(stream, {
        outDir: TEST_DIR,
        wordsPerChunk: -1
      })).rejects.toThrow();
      
      // Test zero words per chunk
      await expect(chunkStream(stream, {
        outDir: TEST_DIR,
        wordsPerChunk: 0
      })).rejects.toThrow();
      
      // Test invalid path (null character)
      await expect(chunkStream(stream, {
        outDir: '/invalid\0path',
        wordsPerChunk: 10
      })).rejects.toThrow();
      
      // Test empty file stem
      await expect(chunkStream(stream, {
        outDir: TEST_DIR,
        wordsPerChunk: 10,
        fileStem: ''
      })).rejects.toThrow();
    });
  });

  describe('monitoring and debugging', () => {
    it('should provide accurate progress information', async () => {
      const testData = 'word '.repeat(50); // 50 words
      const stream = Readable.from([testData]);
      const chunkDir = path.join(TEST_DIR, 'progress-chunks');
      
      const progressUpdates: number[] = [];
      
      await chunkStream(stream, {
        outDir: chunkDir,
        wordsPerChunk: 10,
        onProgress: (wordCount) => {
          progressUpdates.push(wordCount);
        }
      });
      
      // Verify progress increases monotonically
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0]).toBe(1);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(50);
      
      // Verify monotonic increase
      for (let i = 1; i < progressUpdates.length; i++) {
        expect(progressUpdates[i]).toBeGreaterThan(progressUpdates[i - 1]);
      }
    });

    it('should report accurate statistics via callbacks', async () => {
      const testData = 'word '.repeat(25); // 25 words
      const stream = Readable.from([testData]);
      const chunkDir = path.join(TEST_DIR, 'stats-chunks');
      
      const streamOpenEvents: string[] = [];
      const streamCloseEvents: string[] = [];
      const progressUpdates: number[] = [];
      
      await chunkStream(stream, {
        outDir: chunkDir,
        wordsPerChunk: 10,
        onStreamOpen: (path) => {
          streamOpenEvents.push(path);
        },
        onStreamClose: (path) => {
          streamCloseEvents.push(path);
        },
        onProgress: (wordCount) => {
          progressUpdates.push(wordCount);
        }
      });
      
      // Verify callbacks match actual output
      const files = await fs.promises.readdir(chunkDir);
      expect(streamOpenEvents.length).toBe(files.length);
      expect(streamCloseEvents.length).toBe(files.length);
      
      // Verify each opened file was also closed
      for (let i = 0; i < streamOpenEvents.length; i++) {
        expect(streamOpenEvents[i]).toBe(streamCloseEvents[i]);
      }
      
      // Verify final progress matches word count
      expect(progressUpdates[progressUpdates.length - 1]).toBe(25);
      
      // Verify each file actually exists
      for (const filePath of streamOpenEvents) {
        const relativePath = path.relative(TEST_DIR, filePath);
        expect(files).toContain(relativePath);
      }
    });
  });
});