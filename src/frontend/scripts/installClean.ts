import { $ } from "bun";

console.log("Performing clean install...");

// Use Bun Shell's rm for cross-platform compatibility
console.log("Removing node_modules...");
await $`rm -rf ./node_modules`;

// Execute bun install using Bun Shell
console.log("Running bun install...");
await $`bun install`;

console.log("Clean install complete."); 