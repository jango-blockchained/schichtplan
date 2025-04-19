import { $ } from "bun";

console.log("Running project checks...");

// Execute checks sequentially using Bun Shell
// Bun Shell automatically throws on non-zero exit codes by default

console.log("Running typecheck...");
await $`bun run typecheck`;

console.log("Running lint...");
await $`bun run lint`;

console.log("Running format check...");
await $`bun run format:check`;

console.log("All checks passed."); 