import { pipeline } from "@xenova/transformers";
console.log("Downloading embedding model...");
await pipeline("feature-extraction", "Xenova/multilingual-e5-large");
console.log("Model cached successfully.");
