import { Readable } from "node:stream";
import { ChunkStream } from "./ChunkStream";
import { TokenizerStream } from "./TokenizerStream";
import { ChunkOptions } from "./ChunkOptions";

export async function chunkStream(
    stream: Readable,
    options: ChunkOptions = {}
): Promise<void> {
    const tokenizer = new TokenizerStream({ delimiter: options.delimiter });
    const chunkStream = new ChunkStream(options);

    return new Promise((resolve, reject) => {
        stream.on('error', reject);
        tokenizer.on('error', reject);

        tokenizer.on('data', async (word: string) => {
            try {
                await chunkStream.push(word);
            } catch (error) {
                reject(error);
            }
        });

        tokenizer.on('end', async () => {
            try {
                await chunkStream.close();
                resolve();
            } catch (error) {
                reject(error);
            }
        });

        stream.pipe(tokenizer);
    });
}

