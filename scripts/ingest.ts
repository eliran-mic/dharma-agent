import { chunkAllTranscripts } from "../src/ingestion/chunker.js";
import { ingestChunks } from "../src/ingestion/embedder.js";
import { teacherRegistry, getTeacher } from "../src/config.js";

async function main() {
  const teacherArg = process.argv[2];

  const teachers = teacherArg
    ? [getTeacher(teacherArg)].filter(Boolean)
    : teacherRegistry;

  if (teachers.length === 0) {
    console.error(`Teacher "${teacherArg}" not found in registry.`);
    process.exit(1);
  }

  for (const teacher of teachers) {
    if (!teacher) continue;
    console.log(`\n=== Ingesting: ${teacher.name} (${teacher.id}) ===`);

    console.log("Chunking transcripts...");
    const chunks = chunkAllTranscripts(teacher.id);
    console.log(`Created ${chunks.length} chunks.`);

    // Log some stats
    const charCounts = chunks.map((c) => c.text.length);
    const avg = Math.round(
      charCounts.reduce((a, b) => a + b, 0) / charCounts.length
    );
    const min = Math.min(...charCounts);
    const max = Math.max(...charCounts);
    console.log(`Chunk sizes — avg: ${avg}, min: ${min}, max: ${max} chars`);

    console.log("Embedding and storing in ChromaDB...");
    await ingestChunks(chunks, teacher.collectionName);

    console.log(`\nDone with ${teacher.name}.`);
  }

  console.log("\nAll teachers ingested.");
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
