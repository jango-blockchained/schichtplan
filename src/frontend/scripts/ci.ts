import { $ } from "bun";

console.log("Running CI process...");

// Execute CI steps sequentially using Bun Shell
// Bun Shell automatically throws on non-zero exit codes by default

console.log("Step 1: Cleaning...");
// Execute the clean.ts script
await $`bun run ./scripts/clean.ts`; 

console.log("Step 2: Installing dependencies...");
await $`bun install`;

console.log("Step 3: Running checks...");
// Execute the check.ts script
await $`bun run ./scripts/check.ts`;

console.log("Step 4: Running tests...");
await $`bun run test`;

console.log("Step 5: Building project...");
await $`bun run build`;

console.log("CI process completed successfully."); 