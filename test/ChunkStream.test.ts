import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ChunkStream } from '../src/ChunkStream.js';
import { ChunkOptions } from '../src/ChunkOptions.js';

let TEST_DIR: string;

describe('ChunkStream', () => {
  beforeEach(async () => {
    // Create a unique temporary directory
    TEST_DIR = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'chunky-test-'));
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.promises.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, that's fine
    }
  });

  it('should create chunks with default word count', async () => {
    const options: ChunkOptions = {
      outDir: TEST_DIR,
      wordsPerChunk: 3,
      fileStem: 'test',
      fileExt: '.txt'
    };

    const chunkStream = new ChunkStream(options);

    // Push 7 words (should create 3 chunks: 3+3+1)
    const words = ['one', 'two', 'three', 'four', 'five', 'six', 'seven'];
    for (const word of words) {
      await chunkStream.push(word);
    }
    await chunkStream.close();

    // Check that files were created
    const files = await fs.promises.readdir(TEST_DIR);
    expect(files.sort()).toEqual(['test_0.txt', 'test_1.txt', 'test_2.txt']);

    // Check file contents
    const chunk0 = await fs.promises.readFile(path.join(TEST_DIR, 'test_0.txt'), 'utf-8');
    const chunk1 = await fs.promises.readFile(path.join(TEST_DIR, 'test_1.txt'), 'utf-8');
    const chunk2 = await fs.promises.readFile(path.join(TEST_DIR, 'test_2.txt'), 'utf-8');

    expect(chunk0).toBe('one two three');
    expect(chunk1).toBe('four five six');
    expect(chunk2).toBe('seven');
  });

  it('should call callbacks when streams open and close', async () => {
    const onStreamOpen = vi.fn();
    const onStreamClose = vi.fn();
    const onProgress = vi.fn();

    const options: ChunkOptions = {
      outDir: TEST_DIR,
      wordsPerChunk: 2,
      fileStem: 'callback',
      onStreamOpen,
      onStreamClose,
      onProgress
    };

    const chunkStream = new ChunkStream(options);

    await chunkStream.push('word1');
    await chunkStream.push('word2');
    await chunkStream.push('word3'); // Should trigger rotation
    await chunkStream.close();

    expect(onStreamOpen).toHaveBeenCalledTimes(2);
    expect(onStreamClose).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenCalledTimes(3);

    expect(onStreamOpen).toHaveBeenNthCalledWith(1, path.join(TEST_DIR, 'callback_0.txt'));
    expect(onStreamOpen).toHaveBeenNthCalledWith(2, path.join(TEST_DIR, 'callback_1.txt'));
  });

  it('should handle empty input gracefully', async () => {
    const options: ChunkOptions = {
      outDir: TEST_DIR,
      fileStem: 'empty'
    };

    const chunkStream = new ChunkStream(options);
    await chunkStream.close();

    // Should not create any files
    const dirExists = await fs.promises.access(TEST_DIR).then(() => true).catch(() => false);
    expect(dirExists).toBe(false);
  });

  it('should create output directory if it does not exist', async () => {
    const deepDir = path.join(TEST_DIR, 'deep', 'nested', 'path');
    const options: ChunkOptions = {
      outDir: deepDir,
      wordsPerChunk: 1,
      fileStem: 'nested'
    };

    const chunkStream = new ChunkStream(options);
    await chunkStream.push('test');
    await chunkStream.close();

    const files = await fs.promises.readdir(deepDir);
    expect(files).toContain('nested_0.txt');
  });

  it('should handle single word per chunk', async () => {
    const options: ChunkOptions = {
      outDir: TEST_DIR,
      wordsPerChunk: 1,
      fileStem: 'single'
    };

    const chunkStream = new ChunkStream(options);

    await chunkStream.push('alpha');
    await chunkStream.push('beta');
    await chunkStream.push('gamma');
    await chunkStream.close();

    const files = await fs.promises.readdir(TEST_DIR);
    expect(files.sort()).toEqual(['single_0.txt', 'single_1.txt', 'single_2.txt']);

    const alpha = await fs.promises.readFile(path.join(TEST_DIR, 'single_0.txt'), 'utf-8');
    const beta = await fs.promises.readFile(path.join(TEST_DIR, 'single_1.txt'), 'utf-8');
    const gamma = await fs.promises.readFile(path.join(TEST_DIR, 'single_2.txt'), 'utf-8');

    expect(alpha).toBe('alpha');
    expect(beta).toBe('beta');
    expect(gamma).toBe('gamma');
  });

  it('should use custom file extensions', async () => {
    const options: ChunkOptions = {
      outDir: TEST_DIR,
      wordsPerChunk: 2,
      fileStem: 'custom',
      fileExt: '.md'
    };

    const chunkStream = new ChunkStream(options);

    await chunkStream.push('markdown');
    await chunkStream.push('content');
    await chunkStream.close();

    const files = await fs.promises.readdir(TEST_DIR);
    expect(files).toEqual(['custom_0.md']);
  });
});