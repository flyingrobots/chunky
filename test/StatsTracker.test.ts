import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatsTracker } from '../src/StatsTracker.js';
import fs from 'node:fs';

describe('StatsTracker', () => {
  let tracker: StatsTracker;

  beforeEach(() => {
    tracker = new StatsTracker();
    vi.clearAllMocks();
  });

  describe('when tracking a chunking operation', () => {
    it('should provide accurate statistics after processing files', async () => {
      const mockStats = { size: 1000 };
      const statSpy = vi.spyOn(fs.promises, 'stat').mockResolvedValue(mockStats as any);
      
      tracker.start();
      await tracker.trackFile('/test/file1.txt');
      tracker.onStreamOpen('chunk1.txt');
      tracker.onProgress(100);
      tracker.completeFile();
      
      await tracker.trackFile('/test/file2.txt');
      tracker.onStreamOpen('chunk2.txt');
      tracker.onProgress(200);
      tracker.completeFile();
      
      const stats = tracker.finish();
      
      expect(stats.filesProcessed).toBe(2);
      expect(stats.totalWords).toBe(200);
      expect(stats.chunksCreated).toBe(2);
      expect(stats.totalFileSize).toBe(2000);
      expect(stats.averageWordsPerChunk).toBe(100);
    });

    it('should calculate correct average words per chunk', async () => {
      const mockStats = { size: 500 };
      const statSpy = vi.spyOn(fs.promises, 'stat').mockResolvedValue(mockStats as any);
      
      tracker.start();
      await tracker.trackFile('/test/file.txt');
      
      tracker.onStreamOpen('chunk1.txt');
      tracker.onProgress(50);
      tracker.onStreamOpen('chunk2.txt');
      tracker.onProgress(150);
      tracker.onStreamOpen('chunk3.txt');
      tracker.onProgress(300);
      
      tracker.completeFile();
      const stats = tracker.finish();
      
      expect(stats.chunksCreated).toBe(3);
      expect(stats.totalWords).toBe(300);
      expect(stats.averageWordsPerChunk).toBe(100);
    });

    it('should measure processing time accurately', async () => {
      const mockStats = { size: 100 };
      const statSpy = vi.spyOn(fs.promises, 'stat').mockResolvedValue(mockStats as any);
      
      const startTime = performance.now();
      tracker.start();
      
      await tracker.trackFile('/test/file.txt');
      tracker.onStreamOpen('chunk1.txt');
      tracker.onProgress(50);
      tracker.completeFile();
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const stats = tracker.finish();
      const endTime = performance.now();
      
      expect(stats.processingTimeMs).toBeGreaterThan(0);
      expect(stats.processingTimeMs).toBeLessThan(endTime - startTime + 50);
      expect(stats.wordsPerSecond).toBeGreaterThan(0);
      expect(stats.chunksPerSecond).toBeGreaterThan(0);
    });

    it('should handle files that cannot be accessed', async () => {
      const error = new Error('ENOENT: no such file or directory');
      const statSpy = vi.spyOn(fs.promises, 'stat').mockRejectedValue(error);
      
      tracker.start();
      
      await expect(tracker.trackFile('/nonexistent/file.txt'))
        .rejects
        .toThrow('Failed to get file stats for: /nonexistent/file.txt');
    });
  });

  describe('when no files are processed', () => {
    it('should return zero statistics without errors', () => {
      tracker.start();
      const stats = tracker.finish();
      
      expect(stats.filesProcessed).toBe(0);
      expect(stats.totalWords).toBe(0);
      expect(stats.chunksCreated).toBe(0);
      expect(stats.totalFileSize).toBe(0);
      expect(stats.averageWordsPerChunk).toBe(0);
      expect(stats.wordsPerSecond).toBe(0);
      expect(stats.chunksPerSecond).toBe(0);
      expect(stats.averageTimePerFile).toBe(0);
    });
  });

  describe('when tracking very large operations', () => {
    it('should handle thousands of chunks without overflow', async () => {
      const mockStats = { size: 1000 };
      const statSpy = vi.spyOn(fs.promises, 'stat').mockResolvedValue(mockStats as any);
      
      tracker.start();
      await tracker.trackFile('/test/largefile.txt');
      
      for (let i = 0; i < 5000; i++) {
        tracker.onStreamOpen(`chunk${i}.txt`);
        tracker.onProgress((i + 1) * 10);
      }
      
      tracker.completeFile();
      const stats = tracker.finish();
      
      expect(stats.chunksCreated).toBe(5000);
      expect(stats.totalWords).toBe(50000);
      expect(stats.averageWordsPerChunk).toBe(10);
      expect(Number.isFinite(stats.wordsPerSecond)).toBe(true);
      expect(Number.isFinite(stats.chunksPerSecond)).toBe(true);
    });

    it('should track gigabytes of data accurately', async () => {
      const gigabyte = 1024 * 1024 * 1024;
      const mockStats = { size: gigabyte };
      const statSpy = vi.spyOn(fs.promises, 'stat').mockResolvedValue(mockStats as any);
      
      tracker.start();
      
      for (let i = 0; i < 3; i++) {
        await tracker.trackFile(`/test/largefile${i}.txt`);
        tracker.onStreamOpen(`chunk${i}.txt`);
        tracker.onProgress(1000);
        tracker.completeFile();
      }
      
      const stats = tracker.finish();
      
      expect(stats.totalFileSize).toBe(3 * gigabyte);
      expect(stats.filesProcessed).toBe(3);
      expect(stats.totalWords).toBe(1000);
    });
  });

  describe('performance metrics', () => {
    it('should calculate words per second correctly', async () => {
      const mockStats = { size: 100 };
      const statSpy = vi.spyOn(fs.promises, 'stat').mockResolvedValue(mockStats as any);
      
      tracker.start();
      await tracker.trackFile('/test/file.txt');
      tracker.onStreamOpen('chunk1.txt');
      tracker.onProgress(1000);
      tracker.completeFile();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const stats = tracker.finish();
      const expectedRate = 1000 / (stats.processingTimeMs / 1000);
      
      expect(stats.wordsPerSecond).toBeCloseTo(expectedRate, 0);
    });

    it('should calculate chunks per second correctly', async () => {
      const mockStats = { size: 100 };
      const statSpy = vi.spyOn(fs.promises, 'stat').mockResolvedValue(mockStats as any);
      
      tracker.start();
      await tracker.trackFile('/test/file.txt');
      
      for (let i = 0; i < 5; i++) {
        tracker.onStreamOpen(`chunk${i}.txt`);
      }
      tracker.onProgress(100);
      tracker.completeFile();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const stats = tracker.finish();
      const expectedRate = 5 / (stats.processingTimeMs / 1000);
      
      expect(stats.chunksPerSecond).toBeCloseTo(expectedRate, 0);
    });

    it('should handle sub-millisecond operations gracefully', async () => {
      const mockStats = { size: 100 };
      const statSpy = vi.spyOn(fs.promises, 'stat').mockResolvedValue(mockStats as any);
      
      tracker.start();
      await tracker.trackFile('/test/file.txt');
      tracker.onStreamOpen('chunk1.txt');
      tracker.onProgress(100);
      tracker.completeFile();
      
      const stats = tracker.finish();
      
      expect(Number.isFinite(stats.wordsPerSecond)).toBe(true);
      expect(Number.isFinite(stats.chunksPerSecond)).toBe(true);
      expect(Number.isFinite(stats.averageTimePerFile)).toBe(true);
      expect(stats.wordsPerSecond).toBeGreaterThanOrEqual(0);
      expect(stats.chunksPerSecond).toBeGreaterThanOrEqual(0);
    });
  });

  describe('concurrent usage', () => {
    it('should track multiple files being processed simultaneously', async () => {
      const mockStats1 = { size: 500 };
      const mockStats2 = { size: 750 };
      const statSpy = vi.spyOn(fs.promises, 'stat')
        .mockResolvedValueOnce(mockStats1 as any)
        .mockResolvedValueOnce(mockStats2 as any);
      
      tracker.start();
      
      await Promise.all([
        tracker.trackFile('/test/file1.txt'),
        tracker.trackFile('/test/file2.txt')
      ]);
      
      tracker.onStreamOpen('chunk1.txt');
      tracker.onProgress(100);
      tracker.onStreamOpen('chunk2.txt');
      tracker.onProgress(200);
      tracker.completeFile();
      tracker.completeFile();
      
      const stats = tracker.finish();
      
      expect(stats.filesProcessed).toBe(2);
      expect(stats.totalFileSize).toBe(1250);
      expect(stats.chunksCreated).toBe(2);
      expect(stats.totalWords).toBe(200);
    });
  });

  describe('edge cases', () => {
    it('should handle empty files correctly', async () => {
      const mockStats = { size: 0 };
      const statSpy = vi.spyOn(fs.promises, 'stat').mockResolvedValue(mockStats as any);
      
      tracker.start();
      await tracker.trackFile('/test/empty.txt');
      tracker.completeFile();
      
      const stats = tracker.finish();
      
      expect(stats.filesProcessed).toBe(1);
      expect(stats.totalFileSize).toBe(0);
      expect(stats.totalWords).toBe(0);
      expect(stats.chunksCreated).toBe(0);
      expect(stats.averageWordsPerChunk).toBe(0);
    });

    it('should handle files with no words but some bytes', async () => {
      const mockStats = { size: 50 };
      const statSpy = vi.spyOn(fs.promises, 'stat').mockResolvedValue(mockStats as any);
      
      tracker.start();
      await tracker.trackFile('/test/whitespace.txt');
      tracker.onStreamOpen('chunk1.txt');
      tracker.onProgress(0);
      tracker.completeFile();
      
      const stats = tracker.finish();
      
      expect(stats.filesProcessed).toBe(1);
      expect(stats.totalFileSize).toBe(50);
      expect(stats.totalWords).toBe(0);
      expect(stats.chunksCreated).toBe(1);
      expect(stats.averageWordsPerChunk).toBe(0);
    });

    it('should provide meaningful stats for single-word files', async () => {
      const mockStats = { size: 5 };
      const statSpy = vi.spyOn(fs.promises, 'stat').mockResolvedValue(mockStats as any);
      
      tracker.start();
      await tracker.trackFile('/test/oneword.txt');
      tracker.onStreamOpen('chunk1.txt');
      tracker.onProgress(1);
      tracker.completeFile();
      
      const stats = tracker.finish();
      
      expect(stats.filesProcessed).toBe(1);
      expect(stats.totalFileSize).toBe(5);
      expect(stats.totalWords).toBe(1);
      expect(stats.chunksCreated).toBe(1);
      expect(stats.averageWordsPerChunk).toBe(1);
      expect(stats.wordsPerSecond).toBeGreaterThan(0);
    });
  });
});