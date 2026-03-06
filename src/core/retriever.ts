import { ChromaClient } from "chromadb";
import { embedQuery } from "../ingestion/embedder.js";
import { config } from "../config.js";

export interface RetrievedChunk {
  text: string;
  sourceFile: string;
  teacherId: string;
  startTime: number;
  endTime: number;
  score: number;
}

export async function retrieveChunks(
  query: string,
  collectionName: string,
  topK: number = config.retrievalTopK
): Promise<RetrievedChunk[]> {
  const client = new ChromaClient({ path: config.chromaDbUrl });

  let collection;
  try {
    collection = await client.getCollection({ name: collectionName });
  } catch {
    // Collection doesn't exist yet — return empty results
    return [];
  }

  const queryEmbedding = await embedQuery(query);

  const results = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: topK,
  });

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
        score: 1 - distance, // cosine distance to similarity
      });
    }
  }

  return chunks;
}
