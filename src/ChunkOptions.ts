import { Readable } from "stream";
import { z } from "zod";

const DEFAULT_OUT_DIR = "./chunks";
const DEFAULT_WORDS_PER_CHUNK = 1000;
const DEFAULT_FILE_STEM = "chunk";
const DEFAULT_FILE_EXT = ".txt";
const DEFAULT_DELIMITER = /\s+/;

export interface StreamStats {
    bytesProcessed: number;
    currentMemoryUsage: number;
    highWaterMark: number;
    chunksCreated: number;
    wordsProcessed: number;
}

export const ChunkOptionsSchema = z.object({
    wordsPerChunk: z.number().int().positive().optional(),
    delimiter: z.instanceof(RegExp).optional(),
    outputDelimiter: z.string().optional(),
    outDir: z.string().min(1).optional(),
    fileStem: z.string().min(1).optional(),
    fileExt: z.string().regex(/^\.[a-zA-Z0-9]+$/).optional(),
    encoding: z.custom<BufferEncoding>((val) => 
        typeof val === 'string' && 
        ['ascii', 'utf8', 'utf-8', 'utf16le', 'utf-16le', 'ucs2', 'ucs-2', 'base64', 'base64url', 'latin1', 'binary', 'hex'].includes(val)
    ).optional(),
    onStreamOpen: z.custom<(path: string) => void>((val) => typeof val === 'function').optional(),
    onStreamClose: z.custom<(path: string) => void>((val) => typeof val === 'function').optional(),
    onProgress: z.custom<(wordCount: number) => void>((val) => typeof val === 'function').optional(),
    onStats: z.custom<(stats: StreamStats) => void>((val) => typeof val === 'function').optional(),
});

export type ChunkOptions = z.infer<typeof ChunkOptionsSchema>;