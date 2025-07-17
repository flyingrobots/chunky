import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ChunkStream } from '../src/ChunkStream.js';
import { ChunkOptions } from '../src/ChunkOptions.js';

let TEST_DIR: string;

describe('ChunkStream behavior', () => {
  beforeEach(async () => {
    // Create a unique temporary directory
    TEST_DIR = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'chunky-behavior-test-'));
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.promises.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, that's fine
    }
  });

  describe('when chunking text by word count', () => {
    it('should create correct number of chunk files for given word count', async () => {
      const words = Array(1000).fill(0).map((_, i) => `word${i}`);
      const options: ChunkOptions = {
        outDir: TEST_DIR,
        wordsPerChunk: 250,
        fileStem: 'test'
      };

      const chunkStream = new ChunkStream(options);
      
      for (const word of words) {
        await chunkStream.push(word);
      }
      await chunkStream.close();

      const files = await fs.promises.readdir(TEST_DIR);
      expect(files.sort()).toEqual(['test_0000.txt', 'test_0001.txt', 'test_0002.txt', 'test_0003.txt']);
    });

    it('should distribute words evenly across chunks', async () => {
      const words = Array(100).fill(0).map((_, i) => `word${i}`);
      const options: ChunkOptions = {
        outDir: TEST_DIR,
        wordsPerChunk: 25,
        fileStem: 'even'
      };

      const chunkStream = new ChunkStream(options);
      
      for (const word of words) {
        await chunkStream.push(word);
      }
      await chunkStream.close();

      const files = await fs.promises.readdir(TEST_DIR);
      expect(files).toHaveLength(4);

      // Check each chunk has exactly 25 words
      for (let i = 0; i < 4; i++) {
        const content = await fs.promises.readFile(path.join(TEST_DIR, `even_${i}.txt`), 'utf-8');
        const chunkWords = content.split(' ');
        expect(chunkWords).toHaveLength(25);
      }
    });

    it('should handle text that ends mid-word gracefully', async () => {
      const options: ChunkOptions = {
        outDir: TEST_DIR,
        wordsPerChunk: 3,
        fileStem: 'midword'
      };

      const chunkStream = new ChunkStream(options);
      
      // Push words that would cause mid-word cutoff scenarios
      await chunkStream.push('complete');
      await chunkStream.push('word');
      await chunkStream.push('here');
      await chunkStream.push('another');
      await chunkStream.push('set');
      await chunkStream.close();

      const files = await fs.promises.readdir(TEST_DIR);
      expect(files.sort()).toEqual(['midword_0000.txt', 'midword_0001.txt']);

      const chunk0 = await fs.promises.readFile(path.join(TEST_DIR, 'midword_0000.txt'), 'utf-8');
      const chunk1 = await fs.promises.readFile(path.join(TEST_DIR, 'midword_0001.txt'), 'utf-8');

      expect(chunk0).toBe('complete word here');
      expect(chunk1).toBe('another set');
    });
  });

  describe('when output directory does not exist', () => {
    it('should create the directory automatically', async () => {
      const nonExistentDir = path.join(TEST_DIR, 'auto-created');
      const options: ChunkOptions = {
        outDir: nonExistentDir,
        wordsPerChunk: 2,
        fileStem: 'auto'
      };

      const chunkStream = new ChunkStream(options);
      await chunkStream.push('hello');
      await chunkStream.push('world');
      await chunkStream.close();

      // Verify directory was created
      const dirExists = await fs.promises.access(nonExistentDir).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);

      // Verify chunk was written
      const files = await fs.promises.readdir(nonExistentDir);
      expect(files).toEqual(['auto_0000.txt']);
    });

    it('should handle deeply nested directory creation', async () => {
      const deepDir = path.join(TEST_DIR, 'deep', 'nested', 'path', 'chunks');
      const options: ChunkOptions = {
        outDir: deepDir,
        wordsPerChunk: 1,
        fileStem: 'deep'
      };

      const chunkStream = new ChunkStream(options);
      await chunkStream.push('test');
      await chunkStream.close();

      // Verify entire directory tree was created
      const dirExists = await fs.promises.access(deepDir).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);

      const files = await fs.promises.readdir(deepDir);
      expect(files).toEqual(['deep_0000.txt']);
    });

    it('should throw OutputDirectoryError when directory cannot be created', async () => {
      // Use a path that would require root permissions
      const invalidPath = '/root/impossible/path';
      const options: ChunkOptions = {
        outDir: invalidPath,
        wordsPerChunk: 1,
        fileStem: 'fail'
      };

      const chunkStream = new ChunkStream(options);
      
      // This should throw when trying to create the directory
      await expect(async () => {
        await chunkStream.push('test');
      }).rejects.toThrow();
    });
  });

  describe('when customizing output format', () => {
    it('should use custom file stem and extension', async () => {
      const options: ChunkOptions = {
        outDir: TEST_DIR,
        wordsPerChunk: 2,
        fileStem: 'part',
        fileExt: '.md'
      };

      const chunkStream = new ChunkStream(options);
      await chunkStream.push('hello');
      await chunkStream.push('world');
      await chunkStream.push('test');
      await chunkStream.close();

      const files = await fs.promises.readdir(TEST_DIR);
      expect(files.sort()).toEqual(['part_0000.md', 'part_0001.md']);
    });

    it('should handle extensions without leading dot', async () => {
      const options: ChunkOptions = {
        outDir: TEST_DIR,
        wordsPerChunk: 1,
        fileStem: 'nodot',
        fileExt: 'txt'  // No leading dot
      };

      const chunkStream = new ChunkStream(options);
      await chunkStream.push('test');
      await chunkStream.close();

      const files = await fs.promises.readdir(TEST_DIR);
      // Should still create proper extension (implementation may add dot)
      expect(files).toHaveLength(1);
      expect(files[0]).toMatch(/nodot_0\.(txt|\.txt)$/);
    });

    it('should handle empty file stem gracefully', async () => {
      const options: ChunkOptions = {
        outDir: TEST_DIR,
        wordsPerChunk: 1,
        fileStem: '',
        fileExt: '.txt'
      };

      const chunkStream = new ChunkStream(options);
      await chunkStream.push('test');
      await chunkStream.close();

      const files = await fs.promises.readdir(TEST_DIR);
      expect(files).toHaveLength(1);
      // Should create some reasonable default name
      expect(files[0]).toMatch(/_0\.txt$/);
    });
  });

  describe('when using callbacks', () => {
    it('should call onStreamOpen when creating each chunk', async () => {
      const openedFiles: string[] = [];
      
      const options: ChunkOptions = {
        outDir: TEST_DIR,
        wordsPerChunk: 2,
        fileStem: 'callback',
        onStreamOpen: (filePath) => {
          openedFiles.push(filePath);
        }
      };

      const chunkStream = new ChunkStream(options);
      await chunkStream.push('one');
      await chunkStream.push('two');
      await chunkStream.push('three');
      await chunkStream.close();

      expect(openedFiles).toHaveLength(2);
      expect(openedFiles[0]).toBe(path.join(TEST_DIR, 'callback_0000.txt'));
      expect(openedFiles[1]).toBe(path.join(TEST_DIR, 'callback_0001.txt'));
    });

    it('should call onStreamClose after writing each chunk', async () => {
      const closedFiles: string[] = [];
      
      const options: ChunkOptions = {
        outDir: TEST_DIR,
        wordsPerChunk: 2,
        fileStem: 'close',
        onStreamClose: (filePath) => {
          closedFiles.push(filePath);
        }
      };

      const chunkStream = new ChunkStream(options);
      await chunkStream.push('one');
      await chunkStream.push('two');
      await chunkStream.push('three');
      await chunkStream.close();

      expect(closedFiles).toHaveLength(2);
      expect(closedFiles[0]).toBe(path.join(TEST_DIR, 'close_0000.txt'));
      expect(closedFiles[1]).toBe(path.join(TEST_DIR, 'close_0001.txt'));
    });

    it('should call onProgress with running word count', async () => {
      const progressUpdates: number[] = [];
      
      const options: ChunkOptions = {
        outDir: TEST_DIR,
        wordsPerChunk: 2,
        fileStem: 'progress',
        onProgress: (wordCount) => {
          progressUpdates.push(wordCount);
        }
      };

      const chunkStream = new ChunkStream(options);
      await chunkStream.push('one');
      await chunkStream.push('two');
      await chunkStream.push('three');
      await chunkStream.close();

      expect(progressUpdates).toEqual([1, 2, 3]);
    });

    it('should continue processing if callbacks throw errors', async () => {
      const options: ChunkOptions = {
        outDir: TEST_DIR,
        wordsPerChunk: 1,
        fileStem: 'error',
        onStreamOpen: () => {
          throw new Error('Callback error');
        },
        onProgress: () => {
          throw new Error('Progress error');
        }
      };

      const chunkStream = new ChunkStream(options);
      
      // Should not throw despite callback errors
      await chunkStream.push('test');
      await chunkStream.close();

      const files = await fs.promises.readdir(TEST_DIR);
      expect(files).toEqual(['error_0000.txt']);
    });
  });

  describe('when handling different text formats', () => {
    it('should chunk text with custom delimiters', async () => {
      // TODO: Use comma delimiter for CSV-like data
      // TODO: Verify chunks split on commas, not spaces
    });

    it('should handle text with no delimiters', async () => {
      // TODO: Stream continuous text with no spaces
      // TODO: Verify reasonable behavior (single chunk or error)
    });

    it('should handle text with only delimiters', async () => {
      // TODO: Stream only spaces/delimiters
      // TODO: Verify no empty chunks are created
    });

    it('should preserve unicode and special characters', async () => {
      // TODO: Stream text with emojis, unicode, special chars
      // TODO: Verify characters are preserved correctly in chunks
    });
  });

  describe('when processing large streams', () => {
    it('should handle streams larger than memory efficiently', async () => {
      // TODO: Simulate very large stream
      // TODO: Verify memory usage stays reasonable (via callbacks)
    });

    it('should handle slow streams without blocking', async () => {
      // TODO: Create stream that emits data slowly
      // TODO: Verify chunks are written as data arrives
    });
  });

  describe('edge cases', () => {
    it('should handle empty streams gracefully', async () => {
      // TODO: Stream with no data
      // TODO: Verify no chunks are created
    });

    it('should handle single-word streams', async () => {
      // TODO: Stream containing only one word
      // TODO: Verify single chunk is created
    });

    it('should handle extremely long words', async () => {
      // TODO: Stream with 10000-character "word"
      // TODO: Verify word is not split across chunks
    });

    it('should handle words-per-chunk larger than total words', async () => {
      // TODO: Set 1000 words per chunk, stream 100 words
      // TODO: Verify single chunk with all words
    });

    it('should handle concurrent chunk streams to same directory', async () => {
      // TODO: Run multiple ChunkStreams simultaneously
      // TODO: Verify no file conflicts or data corruption
    });
  });

  describe('error recovery', () => {
    it('should clean up partial chunks on stream error', async () => {
      // TODO: Simulate stream error mid-chunk
      // TODO: Verify no partial files remain
    });

    it('should propagate stream errors correctly', async () => {
      // TODO: Create stream that errors
      // TODO: Verify error is catchable by consumer
    });
  });
});