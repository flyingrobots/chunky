#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { SingleBar, Presets } from 'cli-progress';
import fs from 'node:fs';
import path from 'node:path';
import { chunkStream } from './index.js';
import { ChunkOptions } from './ChunkOptions.js';
import { StatsTracker } from './StatsTracker.js';
import { FileStatsError, OutputDirectoryError } from './errors.js';

const statsTracker = new StatsTracker();

const progressBar = new SingleBar({
    format: chalk.cyan('Progress') + ' |{bar}| {percentage}% | {value}/{total} words | ETA: {eta}s',
    barCompleteChar: '█',
    barIncompleteChar: '░',
    hideCursor: true,
}, Presets.shades_classic);

async function processFile(filePath: string, options: ChunkOptions) {
    const spinner = ora(`Processing ${chalk.yellow(path.basename(filePath))}`).start();
    
    try {
        try {
            await statsTracker.trackFile(filePath);
        } catch (error) {
            if (error instanceof FileStatsError) {
                console.warn(chalk.yellow(`⚠️  Could not get file stats for ${path.basename(filePath)}: ${error.cause?.message || 'Unknown error'}`));
            } else {
                throw error;
            }
        }
        
        const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
        
        const chunkOptions: ChunkOptions = {
            ...options,
            onStreamOpen: (chunkPath: string) => {
                statsTracker.onStreamOpen(chunkPath);
                spinner.text = `${chalk.green('✓')} Created chunk: ${chalk.cyan(path.basename(chunkPath))}`;
            },
            onStreamClose: (chunkPath: string) => {
                statsTracker.onStreamClose(chunkPath);
                spinner.text = `${chalk.green('✓')} Completed chunk: ${chalk.cyan(path.basename(chunkPath))}`;
            },
            onProgress: (wordCount: number) => {
                statsTracker.onProgress(wordCount);
                progressBar.setTotal(wordCount);
                progressBar.update(wordCount);
            }
        };
        
        await chunkStream(stream, chunkOptions);
        
        spinner.succeed(`${chalk.green('✓')} Processed ${chalk.yellow(path.basename(filePath))}`);
        statsTracker.completeFile();
        
    } catch (error) {
        if (error instanceof OutputDirectoryError) {
            spinner.fail(`${chalk.red('✗')} Cannot create output directory ${chalk.yellow(error.outputPath)}: ${error.cause?.message || 'Unknown error'}`);
        } else {
            spinner.fail(`${chalk.red('✗')} Failed to process ${chalk.yellow(path.basename(filePath))}: ${error}`);
        }
        throw error;
    }
}

function displayStats() {
    const stats = statsTracker.finish();
    const durationSeconds = stats.processingTimeMs / 1000;
    
    console.log('\n' + chalk.bold.cyan('🤓 CHUNKY NERD STATS 🤓'));
    console.log(chalk.gray('━'.repeat(50)));
    
    console.log(`${chalk.bold('Files Processed:')} ${chalk.yellow(stats.filesProcessed)}`);
    console.log(`${chalk.bold('Total File Size:')} ${chalk.yellow(formatBytes(stats.totalFileSize))}`);
    console.log(`${chalk.bold('Total Words:')} ${chalk.yellow(stats.totalWords.toLocaleString())}`);
    console.log(`${chalk.bold('Chunks Created:')} ${chalk.yellow(stats.chunksCreated)}`);
    console.log(`${chalk.bold('Avg Words/Chunk:')} ${chalk.yellow(Math.round(stats.averageWordsPerChunk).toLocaleString())}`);
    
    console.log(chalk.gray('━'.repeat(50)));
    console.log(`${chalk.bold('Processing Time:')} ${chalk.green(durationSeconds.toFixed(2))}s`);
    console.log(`${chalk.bold('Words/Second:')} ${chalk.green(Math.round(stats.wordsPerSecond).toLocaleString())}`);
    console.log(`${chalk.bold('Chunks/Second:')} ${chalk.green(stats.chunksPerSecond.toFixed(2))}`);
    
    if (stats.filesProcessed > 1) {
        console.log(`${chalk.bold('Avg Time/File:')} ${chalk.green(stats.averageTimePerFile.toFixed(2))}s`);
    }
    
    console.log(chalk.gray('━'.repeat(50)));
    console.log(chalk.bold.green('✨ Chunking complete! ✨'));
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function main() {
    const program = new Command();
    
    program
        .name('chunky')
        .description(chalk.cyan('🔪 A beautiful CLI tool for chunking text files'))
        .version('0.0.1');
    
    program
        .argument('<files...>', 'files to chunk')
        .option('-w, --words <number>', 'words per chunk', '1000')
        .option('-o, --out-dir <dir>', 'output directory', './chunks')
        .option('-s, --stem <stem>', 'file stem for chunks', 'chunk')
        .option('-e, --ext <ext>', 'file extension for chunks', '.txt')
        .option('-d, --delimiter <regex>', 'word delimiter pattern', '\\s+')
        .action(async (files: string[], options) => {
            console.log(chalk.bold.cyan('\n🔪 CHUNKY - Text File Chunker\n'));
            
            statsTracker.start();
            
            const chunkOptions: ChunkOptions = {
                wordsPerChunk: parseInt(options.words),
                outDir: options.outDir,
                fileStem: options.stem,
                fileExt: options.ext,
                delimiter: new RegExp(options.delimiter),
            };
            
            // Validate files exist
            for (const file of files) {
                if (!fs.existsSync(file)) {
                    console.error(chalk.red(`Error: File "${file}" does not exist`));
                    process.exit(1);
                }
            }
            
            console.log(chalk.bold(`Processing ${files.length} file(s)...`));
            console.log(chalk.gray(`Output: ${chunkOptions.outDir}`));
            console.log(chalk.gray(`Words per chunk: ${chunkOptions.wordsPerChunk}`));
            console.log('');
            
            progressBar.start(100, 0);
            
            try {
                for (const file of files) {
                    await processFile(file, chunkOptions);
                }
                
                progressBar.stop();
                
                displayStats();
                
            } catch (error) {
                progressBar.stop();
                console.error(chalk.red('\n❌ Error during processing:'), error);
                process.exit(1);
            }
        });
    
    program.parse();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    progressBar.stop();
    console.log(chalk.yellow('\n⚠️  Process interrupted by user'));
    displayStats();
    process.exit(0);
});

main().catch((error) => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
});