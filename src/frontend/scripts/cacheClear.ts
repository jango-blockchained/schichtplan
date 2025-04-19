import { $ } from "bun";

console.log("Clearing node_modules cache...");

// Use Bun Shell's rm, which is cross-platform
await $`rm -rf ./node_modules/.cache`;

console.log("Cache clear complete."); 