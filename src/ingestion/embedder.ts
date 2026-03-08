import { ChromaClient } from "chromadb";
import { config } from "../config.js";
import type { Chunk } from "./chunker.js";

let embedPipeline: any = null;
let embedLock: Promise<void> = Promise.resolve();

async function getEmbeddingPipeline() {
  if (!embedPipeline) {
    const { pipeline } = await import("@xenova/transformers");
    embedPipeline = await pipeline("feature-extraction", config.embeddingModel);
  }
  return embedPipeline;
}

// Serialize all ONNX inference calls to prevent concurrent native execution (causes SIGSEGV)
async function withEmbedLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = embedLock;
  let resolve: () => void;
  embedLock = new Promise<void>((r) => { resolve = r; });
  await prev;
  try {
    return await fn();
  } finally {
    resolve!();
  }
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  return withEmbedLock(async () => {
    const pipe = await getEmbeddingPipeline();
    const results: number[][] = [];

    for (const text of texts) {
      const output = await pipe(text, {
        pooling: "mean",
        normalize: true,
      });
      results.push(Array.from(output.data as Float32Array));
    }

    return results;
  });
}

export async function embedQuery(query: string): Promise<number[]> {
  const prefixed = `query: ${query}`;
  const [embedding] = await embedTexts([prefixed]);
  return embedding;
}

export async function ingestChunks(
  chunks: Chunk[],
  collectionName: string
): Promise<void> {
  const url = new URL(config.chromaDbUrl);
  const client = new ChromaClient({
    host: url.hostname,
    port: parseInt(url.port || (url.protocol === "https:" ? "443" : "80")),
    ssl: url.protocol === "https:",
  });
  const collection = await client.getOrCreateCollection({
    name: collectionName,
    metadata: { "hnsw:space": "cosine" },
  });

  // Prefix documents for E5 model
  const documents = chunks.map((c) => `passage: ${c.text}`);

  console.log(`Embedding ${chunks.length} chunks...`);
  const embeddings = await embedTexts(documents);

  // Upsert in batches (ChromaDB has batch limits)
  const batchSize = 100;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const end = Math.min(i + batchSize, chunks.length);
    const batchIds = chunks.slice(i, end).map((c, idx) => `${c.teacherId}_${c.sourceFile}_${i + idx}`);
    const batchEmbeddings = embeddings.slice(i, end);
    const batchDocuments = chunks.slice(i, end).map((c) => c.text);
    const batchMetadatas = chunks.slice(i, end).map((c) => ({
      sourceFile: c.sourceFile,
      teacherId: c.teacherId,
      startTime: c.startTime,
      endTime: c.endTime,
      chunkIndex: c.chunkIndex,
    }));

    await collection.add({
      ids: batchIds,
      embeddings: batchEmbeddings,
      documents: batchDocuments,
      metadatas: batchMetadatas,
    });

    console.log(`  Stored batch ${i + 1}-${end} of ${chunks.length}`);
  }

  console.log(
    `Done. Collection "${collectionName}" now has ${(await collection.count())} documents.`
  );
}
