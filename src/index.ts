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

