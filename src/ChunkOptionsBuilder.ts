import { ChunkOptions, ChunkOptionsSchema } from "./ChunkOptions";

export class ChunkOptionsBuilder {
    private options: ChunkOptions = {};

    wordsPerChunk(words: number): this {
        this.options.wordsPerChunk = words;
        return this;
    }

    delimiter(delim: RegExp): this {
        this.options.delimiter = delim;
        return this;
    }

    outputDelimiter(delim: string): this {
        this.options.outputDelimiter = delim;
        return this;
    }

    outDir(dir: string): this {
        this.options.outDir = dir;
        return this;
    }

    fileStem(stem: string): this {
        this.options.fileStem = stem;
        return this;
    }

    fileExt(ext: string): this {
        this.options.fileExt = ext;
        return this;
    }

    encoding(enc: BufferEncoding): this {
        this.options.encoding = enc;
        return this;
    }

    onStreamOpen(fn: (path: string) => void): this {
        this.options.onStreamOpen = fn;
        return this;
    }

    onStreamClose(fn: (path: string) => void): this {
        this.options.onStreamClose = fn;
        return this;
    }

    onProgress(fn: (wordCount: number) => void): this {
        this.options.onProgress = fn;
        return this;
    }

    build(): ChunkOptions {
        const validatedOptions = ChunkOptionsSchema.parse(this.options);
        return { ...validatedOptions };
    }
}