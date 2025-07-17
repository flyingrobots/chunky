import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Readable } from 'node:stream';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { chunkStream } from '../src/index.js';
import { ChunkOptions } from '../src/ChunkOptions.js';

let TEST_DIR: string;

describe('chunkStream integration', () => {
  beforeEach(async () => {
    // Create a unique temporary directory
    TEST_DIR = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'chunky-integration-test-'));
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.promises.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, that's fine
    }
  });

  it('should process a simple text stream', async () => {
    const input = Readable.from(['hello world this is a test of chunking']);
    const options: ChunkOptions = {
      outDir: TEST_DIR,
      wordsPerChunk: 3,
      fileStem: 'simple'
    };

    await chunkStream(input, options);

    const files = await fs.promises.readdir(TEST_DIR);
    expect(files.sort()).toEqual(['simple_0.txt', 'simple_1.txt', 'simple_2.txt']);

    const chunk0 = await fs.promises.readFile(path.join(TEST_DIR, 'simple_0.txt'), 'utf-8');
    const chunk1 = await fs.promises.readFile(path.join(TEST_DIR, 'simple_1.txt'), 'utf-8');
    const chunk2 = await fs.promises.readFile(path.join(TEST_DIR, 'simple_2.txt'), 'utf-8');

    expect(chunk0).toBe('hello world this');
    expect(chunk1).toBe('is a test');
    expect(chunk2).toBe('of chunking');
  });

  it('should handle multi-line input', async () => {
    const input = Readable.from([
      'line one has words\n',
      'line two has more words\n',
      'final line here'
    ]);
    
    const options: ChunkOptions = {
      outDir: TEST_DIR,
      wordsPerChunk: 4,
      fileStem: 'multiline'
    };

    await chunkStream(input, options);

    const files = await fs.promises.readdir(TEST_DIR);
    expect(files.sort()).toEqual(['multiline_0.txt', 'multiline_1.txt', 'multiline_2.txt']);

    const chunk0 = await fs.promises.readFile(path.join(TEST_DIR, 'multiline_0.txt'), 'utf-8');
    const chunk1 = await fs.promises.readFile(path.join(TEST_DIR, 'multiline_1.txt'), 'utf-8');
    const chunk2 = await fs.promises.readFile(path.join(TEST_DIR, 'multiline_2.txt'), 'utf-8');

    expect(chunk0).toBe('line one has words');
    expect(chunk1).toBe('line two has more');
    expect(chunk2).toBe('words final line here');
  });

  it('should handle large chunks that span multiple stream reads', async () => {
    // Create a large text that will span multiple internal reads
    const largeText = Array(1000).fill('word').join(' ');
    const input = Readable.from([largeText]);
    
    const options: ChunkOptions = {
      outDir: TEST_DIR,
      wordsPerChunk: 250, // Should create 4 chunks
      fileStem: 'large'
    };

    await chunkStream(input, options);

    const files = await fs.promises.readdir(TEST_DIR);
    expect(files.sort()).toEqual(['large_0.txt', 'large_1.txt', 'large_2.txt', 'large_3.txt']);

    // Verify each chunk has the expected word count
    for (let i = 0; i < 4; i++) {
      const content = await fs.promises.readFile(path.join(TEST_DIR, `large_${i}.txt`), 'utf-8');
      const words = content.split(' ');
      expect(words).toHaveLength(250);
      expect(words.every(word => word === 'word')).toBe(true);
    }
  });

  it('should handle custom delimiters', async () => {
    const input = Readable.from(['apple,banana,cherry,date,elderberry']);
    const options: ChunkOptions = {
      outDir: TEST_DIR,
      wordsPerChunk: 2,
      fileStem: 'fruits',
      delimiter: /,/
    };

    await chunkStream(input, options);

    const files = await fs.promises.readdir(TEST_DIR);
    expect(files.sort()).toEqual(['fruits_0.txt', 'fruits_1.txt', 'fruits_2.txt']);

    const chunk0 = await fs.promises.readFile(path.join(TEST_DIR, 'fruits_0.txt'), 'utf-8');
    const chunk1 = await fs.promises.readFile(path.join(TEST_DIR, 'fruits_1.txt'), 'utf-8');
    const chunk2 = await fs.promises.readFile(path.join(TEST_DIR, 'fruits_2.txt'), 'utf-8');

    expect(chunk0).toBe('apple banana');
    expect(chunk1).toBe('cherry date');
    expect(chunk2).toBe('elderberry');
  });

  it('should handle empty streams', async () => {
    const input = Readable.from(['']);
    const options: ChunkOptions = {
      outDir: TEST_DIR,
      fileStem: 'empty'
    };

    await chunkStream(input, options);

    // Should not create output directory if no content
    const dirExists = await fs.promises.access(TEST_DIR).then(() => true).catch(() => false);
    expect(dirExists).toBe(false);
  });

  it('should handle streams with only whitespace', async () => {
    const input = Readable.from(['   \t\n\n   \t  ']);
    const options: ChunkOptions = {
      outDir: TEST_DIR,
      fileStem: 'whitespace'
    };

    await chunkStream(input, options);

    // Should not create output directory if no actual content
    const dirExists = await fs.promises.access(TEST_DIR).then(() => true).catch(() => false);
    expect(dirExists).toBe(false);
  });

  it('should propagate stream errors', async () => {
    const errorStream = new Readable({
      read() {
        this.emit('error', new Error('Stream error'));
      }
    });

    const options: ChunkOptions = {
      outDir: TEST_DIR,
      fileStem: 'error'
    };

    await expect(chunkStream(errorStream, options)).rejects.toThrow('Stream error');
  });
});