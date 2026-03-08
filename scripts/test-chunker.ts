import { chunkAllTranscripts } from "../src/ingestion/chunker.js";

const chunks = chunkAllTranscripts("kerem");
console.log("Total chunks:", chunks.length);

const sizes = chunks.map((c) => c.text.length);
const avg = Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length);
console.log(`Avg size: ${avg}, Min: ${Math.min(...sizes)}, Max: ${Math.max(...sizes)} chars`);
console.log("\nSample chunk (first 200 chars):");
console.log(chunks[0].text.substring(0, 200) + "...");
