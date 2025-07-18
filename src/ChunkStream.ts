import { ChunkOptions, ChunkOptionsSchema, StreamStats } from './ChunkOptions.js';
import { TokenizerStream } from './TokenizerStream.js';
import { Writable } from 'node:stream';
import { finished } from 'node:stream';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { DEFAULTS } from './Defaults.js';
import { OutputDirectoryError } from './errors.js';

const finishedAsync = promisify(finished);

enum ChunkOutputStreamState {
    Uninitialized,
    Open,
    Closed
}

export class ChunkStream extends Writable {
    private wordCount: number = 0;
    private chunkCount: number = 0;

    private outputPath: string = DEFAULTS.CHUNK_OUT_DIR;
    private maxWordsPerChunk: number = DEFAULTS.CHUNK_WORD_COUNT;
    private fileStem: string = DEFAULTS.CHUNK_FILE_STEM;
    private fileExt: string = DEFAULTS.CHUNK_FILE_EXT;
    private encoding: BufferEncoding = DEFAULTS.CHUNK_ENCODING;
    private delimiter: RegExp = DEFAULTS.CHUNK_DELIMITER;
    private outputDelimiter: string = DEFAULTS.CHUNK_OUTPUT_DELIMITER;

    private onStreamOpen?: (path: string) => void;
    private onStreamClose?: (path: string) => void;
    private onProgress?: (wordCount: number) => void;
    private onStats?: (stats: StreamStats) => void;

    private outputStreamState: ChunkOutputStreamState = ChunkOutputStreamState.Uninitialized;
    private outputStream: fs.WriteStream | null = null;
    private tokenizer: TokenizerStream;
    private pendingStreamClosures: Promise<void>[] = [];
    
    // Memory tracking
    private bytesProcessed: number = 0;
    private highWaterMark: number = 0;
    private lastStatsEmit: number = Date.now();

    constructor(options: ChunkOptions) {
        super({ objectMode: false });
        
        // Validate options using Zod schema
        ChunkOptionsSchema.parse(options);
        
        this.wordCount = 0;
        this.chunkCount = 0;
        
        if (options.outDir !== undefined) {
            this.outputPath = options.outDir;
        }
        if (options.wordsPerChunk !== undefined) {
            this.maxWordsPerChunk = options.wordsPerChunk;
        }
        if (options.fileStem !== undefined) {
            this.fileStem = options.fileStem;
        }
        if (options.fileExt !== undefined) {
            this.fileExt = options.fileExt;
        }
        if (options.delimiter !== undefined) {
            this.delimiter = options.delimiter;
        }
        
        // Set output delimiter - defaults to input delimiter if simple, otherwise space
        if (options.outputDelimiter !== undefined) {
            this.outputDelimiter = options.outputDelimiter;
        } else {
            // Try to infer output delimiter from input delimiter
            const delimiterSource = this.delimiter.source;
            if (delimiterSource === '\\s+') {
                this.outputDelimiter = ' ';
            } else if (delimiterSource === ',') {
                this.outputDelimiter = ',';
            } else if (delimiterSource === ';') {
                this.outputDelimiter = ';';
            } else if (delimiterSource === '\\t') {
                this.outputDelimiter = '\t';
            } else if (delimiterSource === '\n') {
                this.outputDelimiter = '\n';
            } else if (delimiterSource === '\\|') {
                this.outputDelimiter = '|';
            } else {
                // For complex regex, default to space
                this.outputDelimiter = ' ';
            }
        }
        if (options.onStreamOpen !== undefined) {
            this.onStreamOpen = options.onStreamOpen;
        }
        if (options.onStreamClose !== undefined) {
            this.onStreamClose = options.onStreamClose;
        }
        if (options.onProgress !== undefined) {
            this.onProgress = options.onProgress;
        }
        if (options.onStats !== undefined) {
            this.onStats = options.onStats;
        }
        
        this.outputStreamState = ChunkOutputStreamState.Uninitialized;
        this.tokenizer = new TokenizerStream({ delimiter: this.delimiter });
        this.setupTokenizerPipeline();
    }

    private setupTokenizerPipeline(): void {
        this.tokenizer.on('data', (word: string) => {
            this.processWord(word);
        });

        this.tokenizer.on('error', (error) => {
            this.destroy(error);
        });

        this.tokenizer.on('end', () => {
            this.closeCurrentChunk();
        });
    }

    private makeOutputDirectorySync(): void {
        try {
            fs.mkdirSync(this.outputPath, { recursive: true });
        } catch (error) {
            throw new OutputDirectoryError(this.outputPath, error instanceof Error ? error : undefined);
        }
    }

    private rotateOutputStream(): void {
        if (this.outputStream) {
            // Write a newline to end the chunk cleanly (use OS-specific line ending)
            this.outputStream.write(os.EOL);
            
            const streamToClose = this.outputStream;
            const closeFilePath = this.filePath();
            
            // Clear the reference immediately to prevent further writes
            this.outputStream = null;
            this.chunkCount++;
            
            // End the stream
            streamToClose.end();
            
            // Handle stream closure asynchronously without blocking
            const closurePromise = finishedAsync(streamToClose)
                .then(() => {
                    // Call onStreamClose callback after stream is fully closed
                    if (this.onStreamClose) {
                        try {
                            this.onStreamClose(closeFilePath);
                        } catch (error) {
                            // Ignore callback errors
                        }
                    }
                })
                .catch(error => {
                    console.error('Error finishing output stream:', error);
                    this.destroy(error instanceof Error ? error : new Error(String(error)));
                });
            
            // Track this pending closure and clean up when done
            this.pendingStreamClosures.push(closurePromise);
            closurePromise.finally(() => {
                const index = this.pendingStreamClosures.indexOf(closurePromise);
                if (index > -1) {
                    this.pendingStreamClosures.splice(index, 1);
                }
            });
        }
        this.outputStreamState = ChunkOutputStreamState.Uninitialized;
    }

    private filePath(): string {
        const paddedNumber = (this.chunkCount + 1).toString().padStart(4, '0');
        return path.join(
            this.outputPath.toString(),
            `${this.fileStem}_${paddedNumber}${this.fileExt}`
        );
    }

    private openOutputStream(): void {
        if (this.outputStreamState === ChunkOutputStreamState.Uninitialized) {
            this.outputStreamState = ChunkOutputStreamState.Open;
            this.makeOutputDirectorySync();
            this.outputStream = fs.createWriteStream(
                this.filePath(),
                {
                    encoding: this.encoding
                }
            );
            
            // Add error handling for the output stream immediately
            this.outputStream.on('error', (error) => {
                console.error('Output stream error:', error);
                this.destroy(error);
            });
        }
    }

    _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
        // Track bytes processed
        this.bytesProcessed += Buffer.byteLength(chunk, encoding);
        
        // Calculate current memory usage
        const currentMemoryUsage = this.calculateMemoryUsage();
        if (currentMemoryUsage > this.highWaterMark) {
            this.highWaterMark = currentMemoryUsage;
        }
        
        // Emit stats if callback provided (throttled to once per 100ms)
        if (this.onStats && Date.now() - this.lastStatsEmit > 100) {
            this.emitStats();
        }
        
        const result = this.tokenizer.write(chunk, encoding);
        if (!result) {
            this.tokenizer.once('drain', callback);
        } else {
            callback();
        }
    }

    _final(callback: (error?: Error | null) => void): void {
        // End the tokenizer
        this.tokenizer.end();
        
        // Wait for tokenizer to finish, which will trigger the 'end' event
        // The 'end' event handler will call closeCurrentChunk
        finishedAsync(this.tokenizer)
            .then(() => {
                // Wait for all pending stream closures to complete
                return Promise.all(this.pendingStreamClosures);
            })
            .then(() => {
                // Emit final stats
                if (this.onStats) {
                    this.emitStats();
                }
                callback();
            })
            .catch(error => {
                callback(error instanceof Error ? error : new Error(String(error)));
            });
    }

    private processWord(word: string): void {
        try {
            // Check if writing this word would exceed the current chunk limit
            if (this.outputStreamState === ChunkOutputStreamState.Open && 
                this.wordCount > 0 && 
                this.wordCount % this.maxWordsPerChunk === 0) {
                this.rotateOutputStream();
            }

            // Lazy-open stream if needed
            if (this.outputStreamState === ChunkOutputStreamState.Uninitialized) {
                this.openOutputStream();
                if (this.onStreamOpen) {
                    try {
                        this.onStreamOpen(this.filePath());
                    } catch (error) {
                        // Ignore callback errors
                    }
                }
                this.outputStreamState = ChunkOutputStreamState.Open;
            }

            if (this.outputStream) {
                // Write word with proper spacing logic
                if (this.wordCount % this.maxWordsPerChunk === 0) {
                    // First word in chunk
                    this.outputStream.write(word);
                } else {
                    // Not first word, add delimiter before
                    this.outputStream.write(this.outputDelimiter + word);
                }
            }

            this.wordCount++;
            
            if (this.onProgress) {
                try {
                    this.onProgress(this.wordCount);
                } catch (error) {
                    // Ignore callback errors
                }
            }
        } catch (error) {
            this.destroy(error instanceof Error ? error : new Error(String(error)));
        }
    }

    private closeCurrentChunk(): void {
        if (this.outputStreamState === ChunkOutputStreamState.Open) {
            this.outputStreamState = ChunkOutputStreamState.Closed;
            if (this.outputStream) {
                // Add newline when closing file (use OS-specific line ending)
                this.outputStream.write(os.EOL);
                
                const streamToClose = this.outputStream;
                const closeFilePath = this.filePath();
                
                // Clear the reference immediately to prevent further writes
                this.outputStream = null;
                
                // End the stream
                streamToClose.end();
                
                // Handle stream closure asynchronously without blocking
                const closurePromise = finishedAsync(streamToClose)
                    .then(() => {
                        // Call onStreamClose callback after stream is fully closed
                        if (this.onStreamClose) {
                            try {
                                this.onStreamClose(closeFilePath);
                            } catch (error) {
                                // Ignore callback errors
                            }
                        }
                    })
                    .catch(error => {
                        console.error('Error finishing output stream during close:', error);
                        this.destroy(error instanceof Error ? error : new Error(String(error)));
                    });
                
                // Track this pending closure and clean up when done
                this.pendingStreamClosures.push(closurePromise);
                closurePromise.finally(() => {
                    const index = this.pendingStreamClosures.indexOf(closurePromise);
                    if (index > -1) {
                        this.pendingStreamClosures.splice(index, 1);
                    }
                });
            }
        }
    }
    
    private calculateMemoryUsage(): number {
        // Estimate memory usage based on internal buffers and pending operations
        let memoryUsage = 0;
        
        // Writeable stream buffer
        memoryUsage += this.writableLength || 0;
        
        // Tokenizer buffer (if accessible)
        if (this.tokenizer && 'readableLength' in this.tokenizer) {
            memoryUsage += (this.tokenizer as any).readableLength || 0;
        }
        
        // Output stream buffer
        if (this.outputStream && 'writableLength' in this.outputStream) {
            memoryUsage += this.outputStream.writableLength || 0;
        }
        
        // Rough estimate for pending closures (each promise ~1KB)
        memoryUsage += this.pendingStreamClosures.length * 1024;
        
        return memoryUsage;
    }
    
    private emitStats(): void {
        if (this.onStats) {
            const stats: StreamStats = {
                bytesProcessed: this.bytesProcessed,
                currentMemoryUsage: this.calculateMemoryUsage(),
                highWaterMark: this.highWaterMark,
                chunksCreated: this.chunkCount,
                wordsProcessed: this.wordCount
            };
            
            try {
                this.onStats(stats);
            } catch (error) {
                // Ignore callback errors
            }
            
            this.lastStatsEmit = Date.now();
        }
    }
    
    // Public method to get current stats
    public getStats(): StreamStats {
        return {
            bytesProcessed: this.bytesProcessed,
            currentMemoryUsage: this.calculateMemoryUsage(),
            highWaterMark: this.highWaterMark,
            chunksCreated: this.chunkCount,
            wordsProcessed: this.wordCount
        };
    }
}