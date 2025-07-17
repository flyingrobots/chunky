import { performance } from 'node:perf_hooks';
import fs from 'node:fs';
import { FileStatsError } from './errors.js';

export interface ChunkingStats {
    startTime: number;
    endTime?: number;
    filesProcessed: number;
    totalWords: number;
    chunksCreated: number;
    totalFileSize: number;
    averageWordsPerChunk: number;
    processingTimeMs: number;
    wordsPerSecond: number;
    chunksPerSecond: number;
    averageTimePerFile: number;
}

export class StatsTracker {
    private stats: ChunkingStats;
    private currentFileSize: number = 0;

    constructor() {
        this.stats = {
            startTime: 0,
            filesProcessed: 0,
            totalWords: 0,
            chunksCreated: 0,
            totalFileSize: 0,
            averageWordsPerChunk: 0,
            processingTimeMs: 0,
            wordsPerSecond: 0,
            chunksPerSecond: 0,
            averageTimePerFile: 0,
        };
    }

    start(): void {
        this.stats.startTime = performance.now();
    }

    async trackFile(filePath: string): Promise<void> {
        try {
            const fileStats = await fs.promises.stat(filePath);
            this.currentFileSize = fileStats.size;
            this.stats.totalFileSize += fileStats.size;
        } catch (error) {
            throw new FileStatsError(filePath, error instanceof Error ? error : undefined);
        }
    }

    completeFile(): void {
        this.stats.filesProcessed++;
        this.currentFileSize = 0;
    }

    // Callback for ChunkStream onStreamOpen
    onStreamOpen = (chunkPath: string): void => {
        this.stats.chunksCreated++;
    };

    // Callback for ChunkStream onStreamClose
    onStreamClose = (chunkPath: string): void => {
        // Stream closed - could track additional metrics here if needed
    };

    // Callback for ChunkStream onProgress
    onProgress = (wordCount: number): void => {
        this.stats.totalWords = wordCount;
    };

    finish(): ChunkingStats {
        this.stats.endTime = performance.now();
        this.calculateDerivedStats();
        return this.stats;
    }

    getStats(): ChunkingStats {
        this.calculateDerivedStats();
        return { ...this.stats };
    }

    private calculateDerivedStats(): void {
        const endTime = this.stats.endTime || performance.now();
        this.stats.processingTimeMs = endTime - this.stats.startTime;
        
        const durationSeconds = this.stats.processingTimeMs / 1000;
        
        this.stats.averageWordsPerChunk = this.stats.chunksCreated > 0 
            ? this.stats.totalWords / this.stats.chunksCreated 
            : 0;
            
        this.stats.wordsPerSecond = durationSeconds > 0 
            ? this.stats.totalWords / durationSeconds 
            : 0;
            
        this.stats.chunksPerSecond = durationSeconds > 0 
            ? this.stats.chunksCreated / durationSeconds 
            : 0;
            
        this.stats.averageTimePerFile = this.stats.filesProcessed > 0 
            ? durationSeconds / this.stats.filesProcessed 
            : 0;
    }
}