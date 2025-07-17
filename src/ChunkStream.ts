import { ChunkOptions } from './ChunkOptions';
import path from 'node:path';
import fs from 'node:fs';
import { DEFAULTS } from './Defaults';
import { OutputDirectoryError } from './errors.js';

enum ChunkOutputStreamState {
    Uninitialized,
    Open,
    Closed
}

export class ChunkStream {
    private wordCount: number = 0;
    private chunkCount: number = 0;

    private outputPath: string = DEFAULTS.CHUNK_OUT_DIR;
    private maxWordsPerChunk: number = DEFAULTS.CHUNK_WORD_COUNT;
    private fileStem: string = DEFAULTS.CHUNK_FILE_STEM;
    private fileExt: string = DEFAULTS.CHUNK_FILE_EXT;
    private encoding: BufferEncoding = DEFAULTS.CHUNK_ENCODING;

    private onStreamOpen?: (path: string) => void;
    private onStreamClose?: (path: string) => void;
    private onProgress?: (wordCount: number) => void;

    private outputStreamState: ChunkOutputStreamState = ChunkOutputStreamState.Uninitialized;
    private outputStream: fs.WriteStream | null = null;

    constructor(options: ChunkOptions) {
        this.wordCount = 0;
        this.chunkCount = 0;
        
        // Use options directly since we have TypeScript types
        
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
        if (options.onStreamOpen !== undefined) {
            this.onStreamOpen = options.onStreamOpen;
        }
        if (options.onStreamClose !== undefined) {
            this.onStreamClose = options.onStreamClose;
        }
        if (options.onProgress !== undefined) {
            this.onProgress = options.onProgress;
        }
        

        this.outputStreamState = ChunkOutputStreamState.Uninitialized;
    }

    private async makeOutputDirectory(): Promise<void> {
        try {
            await fs.promises.mkdir(this.outputPath, { recursive: true });
        } catch (error) {
            throw new OutputDirectoryError(this.outputPath, error instanceof Error ? error : undefined);
        }
    }

    private rotateOutputStream(): void {
        if (this.outputStream) {
            if (this.onStreamClose) {
                try {
                    this.onStreamClose(this.filePath());
                } catch (error) {
                    // Ignore callback errors
                }
            }
            this.outputStream.end();
            this.outputStream = null;
        }
        this.chunkCount++;
        this.outputStreamState = ChunkOutputStreamState.Uninitialized;
    }

    private filePath(): string {
        const paddedNumber = this.chunkCount.toString().padStart(4, '0');
        return path.join(
            this.outputPath.toString(),
            `${this.fileStem}_${paddedNumber}${this.fileExt}`
        );
    }

    private async openOutputStream(): Promise<void> {
        if (this.outputStreamState === ChunkOutputStreamState.Uninitialized) {
            this.outputStreamState = ChunkOutputStreamState.Open;
            await this.makeOutputDirectory();
            this.outputStream = fs.createWriteStream(
                this.filePath(),
                {
                    encoding: this.encoding
                }
            );
        }
    }

    public async push(word: string): Promise<void> {
        if (this.outputStreamState === ChunkOutputStreamState.Uninitialized) { 
            if (this.chunkCount === 0) {
                await this.makeOutputDirectory();
            }

            await this.openOutputStream();
            if (this.onStreamOpen) {
                try {
                    this.onStreamOpen(this.filePath());
                } catch (error) {
                    // Ignore callback errors
                }
            }
            this.outputStreamState = ChunkOutputStreamState.Open;
        }

        this.wordCount++;
        
        if (this.outputStream) {
            this.outputStream.write(word + ' ');
        }
        
        if (this.onProgress) {
            try {
                this.onProgress(this.wordCount);
            } catch (error) {
                // Ignore callback errors
            }
        }
        
        if (this.wordCount % this.maxWordsPerChunk === 0) {
            await this.rotateOutputStream();
        }
    }

    public async close(): Promise<void> {
        if (this.outputStreamState === ChunkOutputStreamState.Open) {
            this.outputStreamState = ChunkOutputStreamState.Closed;
            if (this.outputStream) {
                if (this.onStreamClose) {
                    try {
                        this.onStreamClose(this.filePath());
                    } catch (error) {
                        // Ignore callback errors
                    }
                }
                this.outputStream.end();
                this.outputStream = null;
            }
        }
    }
}