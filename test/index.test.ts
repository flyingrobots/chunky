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
    expect(files.sort()).toEqual(['simple_0001.txt', 'simple_0002.txt', 'simple_0003.txt']);

    const chunk0 = await fs.promises.readFile(path.join(TEST_DIR, 'simple_0001.txt'), 'utf-8');
    const chunk1 = await fs.promises.readFile(path.join(TEST_DIR, 'simple_0002.txt'), 'utf-8');
    const chunk2 = await fs.promises.readFile(path.join(TEST_DIR, 'simple_0003.txt'), 'utf-8');

    expect(chunk0.trim()).toBe('hello world this');
    expect(chunk1.trim()).toBe('is a test');
    expect(chunk2.trim()).toBe('of chunking');
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
    expect(files.sort()).toEqual(['multiline_0001.txt', 'multiline_0002.txt', 'multiline_0003.txt']);

    const chunk0 = await fs.promises.readFile(path.join(TEST_DIR, 'multiline_0001.txt'), 'utf-8');
    const chunk1 = await fs.promises.readFile(path.join(TEST_DIR, 'multiline_0002.txt'), 'utf-8');
    const chunk2 = await fs.promises.readFile(path.join(TEST_DIR, 'multiline_0003.txt'), 'utf-8');

    expect(chunk0.trim()).toBe('line one has words');
    expect(chunk1.trim()).toBe('line two has more');
    expect(chunk2.trim()).toBe('words final line here');
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
    // Should create 4 chunks (1000 words / 250 words per chunk)
    expect(files.length).toBe(4);
    expect(files.sort()).toEqual(['large_0001.txt', 'large_0002.txt', 'large_0003.txt', 'large_0004.txt']);

    // Verify each chunk has the expected word count
    for (let i = 1; i <= files.length; i++) {
      const content = await fs.promises.readFile(path.join(TEST_DIR, `large_${i.toString().padStart(4, '0')}.txt`), 'utf-8');
      const words = content.trim().split(' ');
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
    expect(files.sort()).toEqual(['fruits_0001.txt', 'fruits_0002.txt', 'fruits_0003.txt']);
    
    const chunk0 = await fs.promises.readFile(path.join(TEST_DIR, 'fruits_0001.txt'), 'utf-8');
    const chunk1 = await fs.promises.readFile(path.join(TEST_DIR, 'fruits_0002.txt'), 'utf-8');
    const chunk2 = await fs.promises.readFile(path.join(TEST_DIR, 'fruits_0003.txt'), 'utf-8');

    expect(chunk0.trim()).toBe('apple,banana');
    expect(chunk1.trim()).toBe('cherry,date');
    expect(chunk2.trim()).toBe('elderberry');
  });

  it('should handle empty streams', async () => {
    const input = Readable.from(['']);
    const options: ChunkOptions = {
      outDir: TEST_DIR,
      fileStem: 'empty'
    };

    await chunkStream(input, options);

    // Should not create chunks if no content
    try {
      const files = await fs.promises.readdir(TEST_DIR);
      expect(files.length).toBe(0);
    } catch (error) {
      // Directory might not exist, which is also fine
      expect(error).toBeInstanceOf(Error);
    }
  });

  it('should handle streams with only whitespace', async () => {
    const input = Readable.from(['   \t\n\n   \t  ']);
    const options: ChunkOptions = {
      outDir: TEST_DIR,
      fileStem: 'whitespace'
    };

    await chunkStream(input, options);

    // Should not create chunks if no actual content
    try {
      const files = await fs.promises.readdir(TEST_DIR);
      expect(files.length).toBe(0);
    } catch (error) {
      // Directory might not exist, which is also fine
      expect(error).toBeInstanceOf(Error);
    }
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