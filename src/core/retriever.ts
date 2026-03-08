import { ChromaClient, type EmbeddingFunction } from "chromadb";
import { embedQuery } from "../ingestion/embedder.js";
import { config } from "../config.js";

// We provide our own embeddings, so this is a no-op to satisfy ChromaDB's collection requirement
const noopEmbeddingFunction: EmbeddingFunction = {
  generate: async (texts: string[]) => texts.map(() => []),
};

function getChromaClient(): ChromaClient {
  const url = new URL(config.chromaDbUrl);
  return new ChromaClient({
    host: url.hostname,
    port: parseInt(url.port || (url.protocol === "https:" ? "443" : "80")),
    ssl: url.protocol === "https:",
  });
}

export interface RetrievedChunk {
  text: string;
  sourceFile: string;
  teacherId: string;
  startTime: number;
  endTime: number;
  score: number;
}

function parseResults(results: any): RetrievedChunk[] {
  const chunks: RetrievedChunk[] = [];
  if (results.documents[0]) {
    for (let i = 0; i < results.documents[0].length; i++) {
      const meta = results.metadatas[0]?.[i] as Record<string, any> | undefined;
      const distance = results.distances?.[0]?.[i] ?? 1;
      chunks.push({
        text: results.documents[0][i] || "",
        sourceFile: (meta?.sourceFile as string) || "",
        teacherId: (meta?.teacherId as string) || "",
        startTime: (meta?.startTime as number) || 0,
        endTime: (meta?.endTime as number) || 0,
        score: 1 - distance,
      });
    }
  }
  return chunks;
}

/** Retrieve chunks using a pre-computed embedding vector (avoids redundant embedding calls). */
export async function retrieveWithEmbedding(
  queryEmbedding: number[],
  collectionName: string,
  topK: number = config.retrievalTopK
): Promise<RetrievedChunk[]> {
  const client = getChromaClient();

  let collection;
  try {
    collection = await client.getCollection({ name: collectionName, embeddingFunction: noopEmbeddingFunction });
  } catch {
    return [];
  }

  try {
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: topK,
    });
    return parseResults(results);
  } catch (err) {
    console.error(`ChromaDB query failed for ${collectionName}:`, err);
    return [];
  }
}

/** Original convenience function: embeds the query and retrieves. */
export async function retrieveChunks(
  query: string,
  collectionName: string,
  topK: number = config.retrievalTopK
): Promise<RetrievedChunk[]> {
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedQuery(query);
  } catch (err) {
    console.error(`Embedding failed for collection ${collectionName}:`, err);
    return [];
  }
  return retrieveWithEmbedding(queryEmbedding, collectionName, topK);
}

/** Check if ChromaDB is reachable. */
export async function checkChromaHealth(): Promise<boolean> {
  try {
    const client = getChromaClient();
    await client.heartbeat();
    return true;
  } catch {
    return false;
  }
}
