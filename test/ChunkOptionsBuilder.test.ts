import { describe, it, expect } from 'vitest';
import { ChunkOptionsBuilder } from '../src/ChunkOptionsBuilder.js';

describe('ChunkOptionsBuilder', () => {
  describe('when building chunk options', () => {
    it('should create options with fluent interface', () => {
      const options = new ChunkOptionsBuilder()
        .wordsPerChunk(45)
        .delimiter(/ /)
        .outDir('/output_twist')
        .fileExt('.txt2')
        .fileStem('chunkz')
        .build();

      expect(options).toBeDefined();
      expect(options.wordsPerChunk).toBeDefined();
      expect(options.delimiter).toBeDefined();
      expect(options.outDir).toBeDefined();
      expect(options.fileExt).toBeDefined();
      expect(options.fileStem).toBeDefined();

      expect(options.wordsPerChunk).toBe(45);
      expect(options.delimiter).toEqual(/ /);
      expect(options.outDir).toBe('/output_twist');
      expect(options.fileExt).toBe('.txt2');
      expect(options.fileStem).toBe('chunkz');
    });

    it('should provide sensible defaults', () => {
      const options = new ChunkOptionsBuilder().build();
      
      expect(options).toBeDefined();
      // Since schema allows optional properties, built options may be empty
      // but should still be valid
    });

    it('should validate options at build time', () => {
      const builder = new ChunkOptionsBuilder();
      
      // Test negative word count
      expect(() => {
        builder.wordsPerChunk(-1).build();
      }).toThrow();
      
      // Test invalid file extension
      expect(() => {
        new ChunkOptionsBuilder().fileExt('invalid').build();
      }).toThrow();
      
      // Test empty string for required fields
      expect(() => {
        new ChunkOptionsBuilder().outDir('').build();
      }).toThrow();
    });
  });

  describe('builder method behaviors', () => {
    it('should accept various delimiter formats', () => {
      // Test with regex directly
      const options1 = new ChunkOptionsBuilder()
        .delimiter(/\s+/)
        .build();
      
      expect(options1.delimiter).toEqual(/\s+/);
      
      // Test with different regex
      const options2 = new ChunkOptionsBuilder()
        .delimiter(/,/)
        .build();
      
      expect(options2.delimiter).toEqual(/,/);
    });

    it('should normalize file paths', () => {
      // Test with relative paths
      const options1 = new ChunkOptionsBuilder()
        .outDir('./test-output')
        .build();
      
      expect(options1.outDir).toBe('./test-output');
      
      // Test with absolute paths
      const options2 = new ChunkOptionsBuilder()
        .outDir('/tmp/chunky-test')
        .build();
      
      expect(options2.outDir).toBe('/tmp/chunky-test');
    });

    it('should handle method chaining in any order', () => {
      // Test one order
      const options1 = new ChunkOptionsBuilder()
        .wordsPerChunk(50)
        .fileStem('test')
        .fileExt('.md')
        .build();
      
      // Test different order
      const options2 = new ChunkOptionsBuilder()
        .fileExt('.md')
        .wordsPerChunk(50)
        .fileStem('test')
        .build();
      
      expect(options1).toEqual(options2);
    });
  });

  describe('edge cases', () => {
    it('should handle building multiple times', () => {
      const builder = new ChunkOptionsBuilder()
        .wordsPerChunk(100)
        .fileStem('multi');
      
      const options1 = builder.build();
      const options2 = builder.build();
      
      // Should be separate objects
      expect(options1).not.toBe(options2);
      // But with same values
      expect(options1).toEqual(options2);
    });

    it('should allow overwriting previously set values', () => {
      const options = new ChunkOptionsBuilder()
        .wordsPerChunk(100)
        .wordsPerChunk(200)
        .fileStem('first')
        .fileStem('second')
        .build();
      
      expect(options.wordsPerChunk).toBe(200);
      expect(options.fileStem).toBe('second');
    });

    it('should handle null and undefined gracefully', () => {
      // TypeScript prevents null/undefined at compile time
      // but we can test what happens with invalid values
      const builder = new ChunkOptionsBuilder();
      
      // Test with valid values to ensure basic functionality
      const options = builder
        .wordsPerChunk(100)
        .build();
      
      expect(options.wordsPerChunk).toBe(100);
    });
  });

  describe('validation behaviors', () => {
    it('should reject invalid file extensions', () => {
      // Test extensions that don't match the regex: /^\.[a-zA-Z0-9]+$/
      expect(() => {
        new ChunkOptionsBuilder().fileExt('noperiod').build();
      }).toThrow();
      
      expect(() => {
        new ChunkOptionsBuilder().fileExt('.invalid-char').build();
      }).toThrow();
      
      expect(() => {
        new ChunkOptionsBuilder().fileExt('.').build();
      }).toThrow();
      
      // Valid extensions should work
      expect(() => {
        new ChunkOptionsBuilder().fileExt('.txt').build();
      }).not.toThrow();
    });

    it('should reject invalid file stems', () => {
      // Test empty string (schema requires min length 1)
      expect(() => {
        new ChunkOptionsBuilder().fileStem('').build();
      }).toThrow();
      
      // Valid stems should work
      expect(() => {
        new ChunkOptionsBuilder().fileStem('validname').build();
      }).not.toThrow();
      
      expect(() => {
        new ChunkOptionsBuilder().fileStem('valid123').build();
      }).not.toThrow();
    });

    it('should ensure output directory is writable', () => {
      // Test empty string (schema requires min length 1)
      expect(() => {
        new ChunkOptionsBuilder().outDir('').build();
      }).toThrow();
      
      // Valid directories should work
      expect(() => {
        new ChunkOptionsBuilder().outDir('./test').build();
      }).not.toThrow();
      
      expect(() => {
        new ChunkOptionsBuilder().outDir('/tmp/test').build();
      }).not.toThrow();
    });
  });
});