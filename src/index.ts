import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ChunkStream } from "./ChunkStream.js";
import { ChunkOptions } from "./ChunkOptions.js";

export async function chunkStream(
    stream: Readable,
    options: ChunkOptions = {}
): Promise<void> {
    const chunkStream = new ChunkStream(options);
    await pipeline(stream, chunkStream);
}

// Re-export main classes and types
export { ChunkStream } from "./ChunkStream.js";
export { ChunkOptions, ChunkOptionsSchema, StreamStats } from "./ChunkOptions.js";
export { ChunkOptionsBuilder } from "./ChunkOptionsBuilder.js";
export { TokenizerStream, TokenizerOptions } from "./TokenizerStream.js";
export { StatsTracker, ChunkingStats } from "./StatsTracker.js";
export { FileStatsError, OutputDirectoryError } from "./errors.js";
export { DEFAULTS } from "./Defaults.js";
