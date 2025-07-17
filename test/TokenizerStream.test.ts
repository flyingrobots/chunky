import { describe, it, expect } from 'vitest';
import { Readable } from 'node:stream';
import { TokenizerStream } from '../src/TokenizerStream.js';

describe('TokenizerStream', () => {
  it('should tokenize simple space-separated words', async () => {
    const tokenizer = new TokenizerStream();
    const input = Readable.from(['hello world test']);
    const tokens: string[] = [];

    const promise = new Promise<void>((resolve, reject) => {
      tokenizer.on('data', (token) => tokens.push(token));
      tokenizer.on('end', resolve);
      tokenizer.on('error', reject);
    });

    input.pipe(tokenizer);
    await promise;

    expect(tokens).toEqual(['hello', 'world', 'test']);
  });

  it('should handle words split across chunks', async () => {
    const tokenizer = new TokenizerStream();
    const tokens: string[] = [];

    const promise = new Promise<void>((resolve, reject) => {
      tokenizer.on('data', (token) => tokens.push(token));
      tokenizer.on('end', resolve);
      tokenizer.on('error', reject);
    });

    // Simulate chunks that split words
    tokenizer.write('hello wo');
    tokenizer.write('rld test');
    tokenizer.end();

    await promise;

    expect(tokens).toEqual(['hello', 'world', 'test']);
  });

  it('should handle multiple whitespace types', async () => {
    const tokenizer = new TokenizerStream();
    const input = Readable.from(['hello\t\tworld\n\ntest   multiple']);
    const tokens: string[] = [];

    const promise = new Promise<void>((resolve, reject) => {
      tokenizer.on('data', (token) => tokens.push(token));
      tokenizer.on('end', resolve);
      tokenizer.on('error', reject);
    });

    input.pipe(tokenizer);
    await promise;

    expect(tokens).toEqual(['hello', 'world', 'test', 'multiple']);
  });

  it('should handle custom delimiter', async () => {
    const tokenizer = new TokenizerStream({ delimiter: /,/ });
    const input = Readable.from(['apple,banana,cherry']);
    const tokens: string[] = [];

    const promise = new Promise<void>((resolve, reject) => {
      tokenizer.on('data', (token) => tokens.push(token));
      tokenizer.on('end', resolve);
      tokenizer.on('error', reject);
    });

    input.pipe(tokenizer);
    await promise;

    expect(tokens).toEqual(['apple', 'banana', 'cherry']);
  });

  it('should handle empty input', async () => {
    const tokenizer = new TokenizerStream();
    const input = Readable.from(['']);
    const tokens: string[] = [];

    const promise = new Promise<void>((resolve, reject) => {
      tokenizer.on('data', (token) => tokens.push(token));
      tokenizer.on('end', resolve);
      tokenizer.on('error', reject);
    });

    input.pipe(tokenizer);
    await promise;

    expect(tokens).toEqual([]);
  });

  it('should handle input with only whitespace', async () => {
    const tokenizer = new TokenizerStream();
    const input = Readable.from(['   \t\n  ']);
    const tokens: string[] = [];

    const promise = new Promise<void>((resolve, reject) => {
      tokenizer.on('data', (token) => tokens.push(token));
      tokenizer.on('end', resolve);
      tokenizer.on('error', reject);
    });

    input.pipe(tokenizer);
    await promise;

    expect(tokens).toEqual([]);
  });

  it('should preserve the last token even without trailing delimiter', async () => {
    const tokenizer = new TokenizerStream();
    const input = Readable.from(['hello world']);
    const tokens: string[] = [];

    const promise = new Promise<void>((resolve, reject) => {
      tokenizer.on('data', (token) => tokens.push(token));
      tokenizer.on('end', resolve);
      tokenizer.on('error', reject);
    });

    input.pipe(tokenizer);
    await promise;

    expect(tokens).toEqual(['hello', 'world']);
  });
});