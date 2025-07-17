import { Transform, TransformCallback } from 'node:stream';

export interface TokenizerOptions {
    delimiter?: RegExp;
}

export class TokenizerStream extends Transform {
    private buffer: string = '';
    private delimiter: RegExp;

    constructor(options: TokenizerOptions = {}) {
        super({ objectMode: true });
        this.delimiter = options.delimiter || /\s+/;
    }

    _transform(chunk: any, encoding: string, callback: TransformCallback): void {
        this.buffer += chunk.toString();
        
        const tokens = this.buffer.split(this.delimiter);
        
        // Keep the last token in the buffer as it might be incomplete
        this.buffer = tokens.pop() || '';
        
        // Push all complete tokens
        for (const token of tokens) {
            if (token.length > 0) {
                this.push(token);
            }
        }
        
        callback();
    }

    _flush(callback: TransformCallback): void {
        // Push any remaining buffered content as the final token
        if (this.buffer.length > 0) {
            this.push(this.buffer);
        }
        callback();
    }
}