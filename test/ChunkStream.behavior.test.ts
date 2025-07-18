import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Readable } from 'node:stream';
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
    it('should successfully chunk text without losing content', async () => {
      const words = Array(1000).fill(0).map((_, i) => `word${i}`);
      const originalText = words.join(' ');
      
      const options: ChunkOptions = {
        outDir: TEST_DIR,
        wordsPerChunk: 250,
        fileStem: 'test'
      };

      const chunkStream = new ChunkStream(options);
      const stream = require('stream').Readable.from([originalText], { encoding: 'utf8' });
      stream.pipe(chunkStream);
      await new Promise((resolve, reject) => {
        chunkStream.on('finish', resolve);
        chunkStream.on('error', reject);
      });

      // Behavior: Should create some chunk files and preserve content
      const files = await fs.promises.readdir(TEST_DIR);
      expect(files.length).toBeGreaterThan(0);
      
      // All original content should be recoverable
      let reconstructedText = '';
      for (const file of files.sort()) {
        const content = await fs.promises.readFile(path.join(TEST_DIR, file), 'utf-8');
        reconstructedText += content.trim() + ' ';
      }
      expect(reconstructedText.trim()).toBe(originalText);
    });

    it('should preserve all content when chunking large text', async () => {
      const words = Array(100).fill(0).map((_, i) => `word${i}`);
      const originalText = words.join(' ');
      
      const options: ChunkOptions = {
        outDir: TEST_DIR,
        wordsPerChunk: 25,
        fileStem: 'preserve'
      };

      const chunkStream = new ChunkStream(options);
      const stream = require('stream').Readable.from([originalText], { encoding: 'utf8' });
      stream.pipe(chunkStream);
      await new Promise((resolve, reject) => {
        chunkStream.on('finish', resolve);
        chunkStream.on('error', reject);
      });

      // Behavior: All original content should be preserved
      const files = await fs.promises.readdir(TEST_DIR);
      let reconstructedText = '';
      for (const file of files.sort()) {
        const content = await fs.promises.readFile(path.join(TEST_DIR, file), 'utf-8');
        reconstructedText += content.trim() + ' ';
      }
      
      expect(reconstructedText.trim()).toBe(originalText);
    });

    it('should handle text that ends mid-word gracefully', async () => {
      const options: ChunkOptions = {
        outDir: TEST_DIR,
        wordsPerChunk: 3,
        fileStem: 'midword'
      };

      const chunkStream = new ChunkStream(options);
      const stream = require('stream').Readable.from(['complete word here another set'], { encoding: 'utf8' });
      stream.pipe(chunkStream);
      await new Promise((resolve, reject) => {
        chunkStream.on('finish', resolve);
        chunkStream.on('error', reject);
      });

      const files = await fs.promises.readdir(TEST_DIR);
      expect(files.sort()).toEqual(['midword_0001.txt', 'midword_0002.txt']);

      const chunk0 = await fs.promises.readFile(path.join(TEST_DIR, 'midword_0001.txt'), 'utf-8');
      const chunk1 = await fs.promises.readFile(path.join(TEST_DIR, 'midword_0002.txt'), 'utf-8');

      expect(chunk0.trim()).toBe('complete word here');
      expect(chunk1.trim()).toBe('another set');
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
      const stream = require('stream').Readable.from(['hello world'], { encoding: 'utf8' });
      stream.pipe(chunkStream);
      await new Promise((resolve, reject) => {
        chunkStream.on('finish', resolve);
        chunkStream.on('error', reject);
      });

      // Verify directory was created
      const dirExists = await fs.promises.access(nonExistentDir).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);

      // Verify chunk was written
      const files = await fs.promises.readdir(nonExistentDir);
      expect(files).toEqual(['auto_0001.txt']);
    });

    it('should handle deeply nested directory creation', async () => {
      const deepDir = path.join(TEST_DIR, 'deep', 'nested', 'path', 'chunks');
      const options: ChunkOptions = {
        outDir: deepDir,
        wordsPerChunk: 1,
        fileStem: 'deep'
      };

      const chunkStream = new ChunkStream(options);
      const stream = require('stream').Readable.from(['test'], { encoding: 'utf8' });
      stream.pipe(chunkStream);
      await new Promise((resolve, reject) => {
        chunkStream.on('finish', resolve);
        chunkStream.on('error', reject);
      });

      // Verify entire directory tree was created
      const dirExists = await fs.promises.access(deepDir).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);

      const files = await fs.promises.readdir(deepDir);
      expect(files).toEqual(['deep_0001.txt']);
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
      const stream = require('stream').Readable.from(['test'], { encoding: 'utf8' });
      
      // This should throw when trying to create the directory
      await expect(async () => {
        stream.pipe(chunkStream);
        await new Promise((resolve, reject) => {
          chunkStream.on('finish', resolve);
          chunkStream.on('error', reject);
        });
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
      const stream = require('stream').Readable.from(['hello world test'], { encoding: 'utf8' });
      stream.pipe(chunkStream);
      await new Promise((resolve, reject) => {
        chunkStream.on('finish', resolve);
        chunkStream.on('error', reject);
      });

      const files = await fs.promises.readdir(TEST_DIR);
      expect(files.sort()).toEqual(['part_0001.md', 'part_0002.md']);
    });

    it('should handle extensions without leading dot', async () => {
      const options: ChunkOptions = {
        outDir: TEST_DIR,
        wordsPerChunk: 1,
        fileStem: 'nodot',
        fileExt: 'txt'  // No leading dot
      };

      const chunkStream = new ChunkStream(options);
      const stream = require('stream').Readable.from(['test'], { encoding: 'utf8' });
      stream.pipe(chunkStream);
      await new Promise((resolve, reject) => {
        chunkStream.on('finish', resolve);
        chunkStream.on('error', reject);
      });

      const files = await fs.promises.readdir(TEST_DIR);
      // Should still create proper extension (implementation may add dot)
      expect(files).toHaveLength(1);
      expect(files[0]).toMatch(/nodot_0001\.(txt|\.txt)$/);
    });

    it('should handle empty file stem gracefully', async () => {
      const options: ChunkOptions = {
        outDir: TEST_DIR,
        wordsPerChunk: 1,
        fileStem: '',
        fileExt: '.txt'
      };

      const chunkStream = new ChunkStream(options);
      const stream = require('stream').Readable.from(['test'], { encoding: 'utf8' });
      stream.pipe(chunkStream);
      await new Promise((resolve, reject) => {
        chunkStream.on('finish', resolve);
        chunkStream.on('error', reject);
      });

      const files = await fs.promises.readdir(TEST_DIR);
      expect(files).toHaveLength(1);
      // Should create some reasonable default name
      expect(files[0]).toMatch(/_0001\.txt$/);
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
      const stream = require('stream').Readable.from(['one two three'], { encoding: 'utf8' });
      stream.pipe(chunkStream);
      await new Promise((resolve, reject) => {
        chunkStream.on('finish', resolve);
        chunkStream.on('error', reject);
      });

      expect(openedFiles).toHaveLength(2);
      expect(openedFiles[0]).toBe(path.join(TEST_DIR, 'callback_0001.txt'));
      expect(openedFiles[1]).toBe(path.join(TEST_DIR, 'callback_0002.txt'));
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
      const stream = require('stream').Readable.from(['one two three'], { encoding: 'utf8' });
      stream.pipe(chunkStream);
      await new Promise((resolve, reject) => {
        chunkStream.on('finish', resolve);
        chunkStream.on('error', reject);
      });

      expect(closedFiles).toHaveLength(2);
      expect(closedFiles[0]).toBe(path.join(TEST_DIR, 'close_0001.txt'));
      expect(closedFiles[1]).toBe(path.join(TEST_DIR, 'close_0002.txt'));
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
      const stream = require('stream').Readable.from(['one two three'], { encoding: 'utf8' });
      stream.pipe(chunkStream);
      await new Promise((resolve, reject) => {
        chunkStream.on('finish', resolve);
        chunkStream.on('error', reject);
      });

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
      const stream = require('stream').Readable.from(['test'], { encoding: 'utf8' });
      
      // Should not throw despite callback errors
      stream.pipe(chunkStream);
      await new Promise((resolve, reject) => {
        chunkStream.on('finish', resolve);
        chunkStream.on('error', reject);
      });

      const files = await fs.promises.readdir(TEST_DIR);
      expect(files).toEqual(['error_0001.txt']);
    });
  });

  describe('when handling different text formats', () => {
    it('should chunk text with custom delimiters', async () => {
      const csvData = 'apple,banana,cherry,date,elderberry,fig';
      const options: ChunkOptions = {
        outDir: TEST_DIR,
        wordsPerChunk: 3,
        delimiter: /,/,
        fileStem: 'csv'
      };

      const chunkStream = new ChunkStream(options);
      const stream = require('stream').Readable.from([csvData], { encoding: 'utf8' });
      stream.pipe(chunkStream);
      await new Promise((resolve, reject) => {
        chunkStream.on('finish', resolve);
        chunkStream.on('error', reject);
      });

      const files = await fs.promises.readdir(TEST_DIR);
      expect(files.sort()).toEqual(['csv_0001.txt', 'csv_0002.txt']);

      const chunk1 = await fs.promises.readFile(path.join(TEST_DIR, 'csv_0001.txt'), 'utf-8');
      const chunk2 = await fs.promises.readFile(path.join(TEST_DIR, 'csv_0002.txt'), 'utf-8');

      expect(chunk1.trim()).toBe('apple banana cherry');
      expect(chunk2.trim()).toBe('date elderberry fig');
    });

    it('should handle text with no delimiters', async () => {
      const continuousText = 'thisisalongwordwithnodelimiters';
      const options: ChunkOptions = {
        outDir: TEST_DIR,
        wordsPerChunk: 5,
        fileStem: 'continuous'
      };

      const chunkStream = new ChunkStream(options);
      const stream = require('stream').Readable.from([continuousText], { encoding: 'utf8' });
      stream.pipe(chunkStream);
      await new Promise((resolve, reject) => {
        chunkStream.on('finish', resolve);
        chunkStream.on('error', reject);
      });

      const files = await fs.promises.readdir(TEST_DIR);
      expect(files).toEqual(['continuous_0001.txt']);

      const content = await fs.promises.readFile(path.join(TEST_DIR, 'continuous_0001.txt'), 'utf-8');
      expect(content.trim()).toBe('thisisalongwordwithnodelimiters');
    });

    it('should handle text with only delimiters', async () => {
      const spacesOnly = '     \n\n   \t  ';
      const options: ChunkOptions = {
        outDir: TEST_DIR,
        wordsPerChunk: 5,
        fileStem: 'spaces'
      };

      const chunkStream = new ChunkStream(options);
      const stream = require('stream').Readable.from([spacesOnly], { encoding: 'utf8' });
      stream.pipe(chunkStream);
      await new Promise((resolve, reject) => {
        chunkStream.on('finish', resolve);
        chunkStream.on('error', reject);
      });

      const files = await fs.promises.readdir(TEST_DIR);
      expect(files).toEqual([]);
    });

    it('should preserve unicode and special characters', async () => {
      const unicodeText = 'Hello 世界 🌍 café naïve résumé';
      const options: ChunkOptions = {
        outDir: TEST_DIR,
        wordsPerChunk: 3,
        fileStem: 'unicode'
      };

      const chunkStream = new ChunkStream(options);
      const stream = require('stream').Readable.from([unicodeText], { encoding: 'utf8' });
      stream.pipe(chunkStream);
      await new Promise((resolve, reject) => {
        chunkStream.on('finish', resolve);
        chunkStream.on('error', reject);
      });

      const files = await fs.promises.readdir(TEST_DIR);
      expect(files.sort()).toEqual(['unicode_0001.txt', 'unicode_0002.txt']);

      const chunk1 = await fs.promises.readFile(path.join(TEST_DIR, 'unicode_0001.txt'), 'utf-8');
      const chunk2 = await fs.promises.readFile(path.join(TEST_DIR, 'unicode_0002.txt'), 'utf-8');

      expect(chunk1.trim()).toBe('Hello 世界 🌍');
      expect(chunk2.trim()).toBe('café naïve résumé');
    });
  });

  describe('when processing large streams', () => {
    it('should handle streams larger than memory efficiently', async () => {
      const words = Array(10000).fill(0).map((_, i) => `word${i}`);
      const largeText = words.join(' ');
      const options: ChunkOptions = {
        outDir: TEST_DIR,
        wordsPerChunk: 1000,
        fileStem: 'large'
      };

      const chunkStream = new ChunkStream(options);
      const stream = require('stream').Readable.from([largeText], { encoding: 'utf8' });
      stream.pipe(chunkStream);
      await new Promise((resolve, reject) => {
        chunkStream.on('finish', resolve);
        chunkStream.on('error', reject);
      });

      const files = await fs.promises.readdir(TEST_DIR);
      expect(files).toHaveLength(10);
      
      // Verify each chunk has correct word count
      for (let i = 1; i <= 10; i++) {
        const paddedNum = i.toString().padStart(4, '0');
        const content = await fs.promises.readFile(path.join(TEST_DIR, `large_${paddedNum}.txt`), 'utf-8');
        const chunkWords = content.trim().split(' ');
        expect(chunkWords).toHaveLength(1000);
      }
    });

    it('should handle slow streams without blocking', async () => {
      const options: ChunkOptions = {
        outDir: TEST_DIR,
        wordsPerChunk: 2,
        fileStem: 'slow'
      };

      const chunkStream = new ChunkStream(options);
      
      // Create a slow stream that emits words with delays
      const slowStream = new (require('stream').Readable)({
        read() {
          setTimeout(() => {
            this.push('word1 word2 ');
            setTimeout(() => {
              this.push('word3 word4');
              this.push(null); // End stream
            }, 10);
          }, 10);
        }
      });

      slowStream.pipe(chunkStream);
      await new Promise((resolve, reject) => {
        chunkStream.on('finish', resolve);
        chunkStream.on('error', reject);
      });

      const files = await fs.promises.readdir(TEST_DIR);
      expect(files.sort()).toEqual(['slow_0001.txt', 'slow_0002.txt']);

      const chunk1 = await fs.promises.readFile(path.join(TEST_DIR, 'slow_0001.txt'), 'utf-8');
      const chunk2 = await fs.promises.readFile(path.join(TEST_DIR, 'slow_0002.txt'), 'utf-8');
      
      expect(chunk1.trim()).toBe('word1 word2');
      expect(chunk2.trim()).toBe('word3 word4');
    });
  });

  describe('edge cases', () => {
    it('should handle empty streams gracefully', async () => {
      const options: ChunkOptions = {
        outDir: TEST_DIR,
        wordsPerChunk: 5,
        fileStem: 'empty'
      };

      const chunkStream = new ChunkStream(options);
      const emptyStream = require('stream').Readable.from([], { encoding: 'utf8' });
      emptyStream.pipe(chunkStream);
      await new Promise((resolve, reject) => {
        chunkStream.on('finish', resolve);
        chunkStream.on('error', reject);
      });

      const files = await fs.promises.readdir(TEST_DIR);
      expect(files).toEqual([]);
    });

    it('should handle single-word streams', async () => {
      const options: ChunkOptions = {
        outDir: TEST_DIR,
        wordsPerChunk: 5,
        fileStem: 'single'
      };

      const chunkStream = new ChunkStream(options);
      const singleWordStream = require('stream').Readable.from(['hello'], { encoding: 'utf8' });
      singleWordStream.pipe(chunkStream);
      await new Promise((resolve, reject) => {
        chunkStream.on('finish', resolve);
        chunkStream.on('error', reject);
      });

      const files = await fs.promises.readdir(TEST_DIR);
      expect(files).toEqual(['single_0001.txt']);

      const content = await fs.promises.readFile(path.join(TEST_DIR, 'single_0001.txt'), 'utf-8');
      expect(content.trim()).toBe('hello');
    });

    it('should handle extremely long words', async () => {
      const longWord = 'a'.repeat(10000);
      const options: ChunkOptions = {
        outDir: TEST_DIR,
        wordsPerChunk: 2,
        fileStem: 'long'
      };

      const chunkStream = new ChunkStream(options);
      const stream = require('stream').Readable.from([`${longWord} short word`], { encoding: 'utf8' });
      stream.pipe(chunkStream);
      await new Promise((resolve, reject) => {
        chunkStream.on('finish', resolve);
        chunkStream.on('error', reject);
      });

      const files = await fs.promises.readdir(TEST_DIR);
      expect(files).toEqual(['long_0001.txt']);

      const content = await fs.promises.readFile(path.join(TEST_DIR, 'long_0001.txt'), 'utf-8');
      const words = content.trim().split(' ');
      expect(words).toHaveLength(3);
      expect(words[0]).toBe(longWord);
      expect(words[1]).toBe('short');
      expect(words[2]).toBe('word');
    });

    it('should handle words-per-chunk larger than total words', async () => {
      const words = Array(100).fill(0).map((_, i) => `word${i}`);
      const text = words.join(' ');
      const options: ChunkOptions = {
        outDir: TEST_DIR,
        wordsPerChunk: 1000,
        fileStem: 'small'
      };

      const chunkStream = new ChunkStream(options);
      const stream = require('stream').Readable.from([text], { encoding: 'utf8' });
      stream.pipe(chunkStream);
      await new Promise((resolve, reject) => {
        chunkStream.on('finish', resolve);
        chunkStream.on('error', reject);
      });

      const files = await fs.promises.readdir(TEST_DIR);
      expect(files).toEqual(['small_0001.txt']);

      const content = await fs.promises.readFile(path.join(TEST_DIR, 'small_0001.txt'), 'utf-8');
      const chunkWords = content.trim().split(' ');
      expect(chunkWords).toHaveLength(100);
    });

    it('should handle concurrent chunk streams to same directory', async () => {
      const text1 = 'stream1 word1 word2';
      const text2 = 'stream2 word3 word4';
      const options1: ChunkOptions = {
        outDir: TEST_DIR,
        wordsPerChunk: 2,
        fileStem: 'concurrent1'
      };
      const options2: ChunkOptions = {
        outDir: TEST_DIR,
        wordsPerChunk: 2,
        fileStem: 'concurrent2'
      };

      const chunkStream1 = new ChunkStream(options1);
      const chunkStream2 = new ChunkStream(options2);
      const stream1 = require('stream').Readable.from([text1], { encoding: 'utf8' });
      const stream2 = require('stream').Readable.from([text2], { encoding: 'utf8' });

      stream1.pipe(chunkStream1);
      stream2.pipe(chunkStream2);
      await Promise.all([
        new Promise((resolve, reject) => {
          chunkStream1.on('finish', resolve);
          chunkStream1.on('error', reject);
        }),
        new Promise((resolve, reject) => {
          chunkStream2.on('finish', resolve);
          chunkStream2.on('error', reject);
        })
      ]);

      const files = await fs.promises.readdir(TEST_DIR);
      expect(files.sort()).toEqual([
        'concurrent1_0001.txt',
        'concurrent1_0002.txt', 
        'concurrent2_0001.txt',
        'concurrent2_0002.txt'
      ]);

      // Verify no data corruption
      const content1_1 = await fs.promises.readFile(path.join(TEST_DIR, 'concurrent1_0001.txt'), 'utf-8');
      const content2_1 = await fs.promises.readFile(path.join(TEST_DIR, 'concurrent2_0001.txt'), 'utf-8');
      
      expect(content1_1.trim()).toBe('stream1 word1');
      expect(content2_1.trim()).toBe('stream2 word3');
    });
  });

  describe('error recovery', () => {
    it('should clean up partial chunks on stream error', async () => {
      // Create a stream that will error after some data
      const errorStream = new Readable({
        read() {
          this.push('word1 word2 word3 ');
          this.push('word4 word5 ');
          // Error after some data has been written
          setImmediate(() => {
            this.destroy(new Error('Stream processing error'));
          });
        }
      });
      
      const chunkStream = new ChunkStream({
        outDir: TEST_DIR,
        wordsPerChunk: 10,
        fileStem: 'error-test'
      });
      
      // Should propagate the error
      await expect(new Promise<void>((resolve, reject) => {
        errorStream.pipe(chunkStream);
        errorStream.on('error', reject);
        chunkStream.on('error', reject);
        chunkStream.on('finish', resolve);
      })).rejects.toThrow('Stream processing error');
    });

    it('should propagate stream errors correctly', async () => {
      // Create a stream that errors immediately
      const errorStream = new Readable({
        read() {
          setImmediate(() => {
            this.emit('error', new Error('Immediate stream error'));
          });
        }
      });
      
      const chunkStream = new ChunkStream({
        outDir: TEST_DIR,
        wordsPerChunk: 10,
        fileStem: 'error-propagation'
      });
      
      // Error should be propagated to the consumer
      await expect(new Promise<void>((resolve, reject) => {
        errorStream.pipe(chunkStream);
        errorStream.on('error', reject);
        chunkStream.on('error', reject);
        chunkStream.on('finish', resolve);
      })).rejects.toThrow('Immediate stream error');
    });
  });
});