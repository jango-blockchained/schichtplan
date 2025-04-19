import { $ } from "bun";

console.log("Cleaning project directories...");

// Use Bun Shell's rm, which is cross-platform
await $`rm -rf ./dist`;
await $`rm -rf ./node_modules/.vite`;

console.log("Clean complete."); 