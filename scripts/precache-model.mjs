import { pipeline } from "@xenova/transformers";
console.log("Downloading embedding model...");
await pipeline("feature-extraction", "Xenova/multilingual-e5-small");
console.log("Model cached successfully.");
