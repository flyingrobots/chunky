# 🍫 Chunky

> When your code needs to be broken down into bite-sized pieces!

## What is Chunky?

Chunky is a delightful utility that takes your large, unwieldy files and transforms them into perfectly portioned chunks. Like breaking a chocolate bar into squares, but for your code!

## Why Chunky?

- **🎯 Precision Splitting**: Break files exactly where you want them
- **📏 Size Control**: Set your ideal chunk size and let Chunky do the rest
- **🚀 Lightning Fast**: Written in TypeScript for maximum performance
- **🎨 Developer Friendly**: Clean API that just makes sense

## Getting Started

```bash
# Install dependencies
pnpm install

# Run Chunky
pnpm start

# Run tests
pnpm test
```

## Usage

```typescript
import { chunk } from '@/chunky';

// Break it down!
const chunks = await chunk('massive-file.txt', {
  size: 1024,  // 1KB chunks
  overlap: 50  // 50 byte overlap between chunks
});
```

## Contributing

Found a bug? Have an idea? We'd love your help making Chunky even better!

1. Fork it
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT - Go forth and chunk responsibly!

---

*Remember: Life is too short for monolithic files. Stay chunky! 🍫*