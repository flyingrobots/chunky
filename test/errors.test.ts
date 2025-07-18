import { describe, it, expect } from 'vitest';
import { FileStatsError, OutputDirectoryError } from '../src/errors.js';

describe.skip('FileStatsError', () => {
  it('should create error with file path and no cause', () => {
    const filePath = '/test/file.txt';
    const error = new FileStatsError(filePath);
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(FileStatsError);
    expect(error.filePath).toBe(filePath);
    expect(error.cause).toBeUndefined();
  });

  it('should create error with file path and cause', () => {
    const filePath = '/test/file.txt';
    const cause = new Error('ENOENT: no such file');
    const error = new FileStatsError(filePath, cause);
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(FileStatsError);
    expect(error.filePath).toBe(filePath);
    expect(error.cause).toBe(cause);
  });

  it('should have correct error name', () => {
    const error = new FileStatsError('/test/file.txt');
    expect(error.name).toBe('FileStatsError');
  });

  it('should have descriptive message', () => {
    const filePath = '/test/important-file.txt';
    const error = new FileStatsError(filePath);
    
    expect(error.message).toContain('Failed to get file stats for');
    expect(error.message).toContain(filePath);
  });
});

describe('OutputDirectoryError', () => {
  it('should create error with output path and no cause', () => {
    const outputPath = '/output/directory';
    const error = new OutputDirectoryError(outputPath);
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(OutputDirectoryError);
    expect(error.outputPath).toBe(outputPath);
    expect(error.cause).toBeUndefined();
  });

  it('should create error with output path and cause', () => {
    const outputPath = '/output/directory';
    const cause = new Error('EACCES: permission denied');
    const error = new OutputDirectoryError(outputPath, cause);
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(OutputDirectoryError);
    expect(error.outputPath).toBe(outputPath);
    expect(error.cause).toBe(cause);
  });

  it('should have correct error name', () => {
    const error = new OutputDirectoryError('/output/directory');
    expect(error.name).toBe('OutputDirectoryError');
  });

  it('should have descriptive message', () => {
    const outputPath = '/output/important-directory';
    const error = new OutputDirectoryError(outputPath);
    
    expect(error.message).toContain('Failed to create output directory');
    expect(error.message).toContain(outputPath);
  });

  // Edge cases
  it('should handle very long paths', () => {
    const longPath = '/very/long/path/that/goes/on/and/on/and/on/and/on/and/on/and/on/and/on/and/on/and/on/and/on/and/on/and/on/file.txt';
    const fileError = new FileStatsError(longPath);
    const dirError = new OutputDirectoryError(longPath);
    
    expect(fileError.filePath).toBe(longPath);
    expect(fileError.message).toContain(longPath);
    expect(dirError.outputPath).toBe(longPath);
    expect(dirError.message).toContain(longPath);
  });

  it('should handle paths with special characters', () => {
    const specialPath = '/path with spaces/unicode-文件/emoji-📁/file.txt';
    const fileError = new FileStatsError(specialPath);
    const dirError = new OutputDirectoryError(specialPath);
    
    expect(fileError.filePath).toBe(specialPath);
    expect(fileError.message).toContain(specialPath);
    expect(dirError.outputPath).toBe(specialPath);
    expect(dirError.message).toContain(specialPath);
  });
});