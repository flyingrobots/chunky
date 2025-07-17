export class FileStatsError extends Error {
    constructor(public readonly filePath: string, public readonly cause?: Error) {
        super(`Failed to get file stats for: ${filePath}`);
        this.name = 'FileStatsError';
    }
}

export class OutputDirectoryError extends Error {
    constructor(public readonly outputPath: string, public readonly cause?: Error) {
        super(`Failed to create output directory: ${outputPath}`);
        this.name = 'OutputDirectoryError';
    }
}