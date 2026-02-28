import { Router, type Request, type Response } from "express";
import { chunkAllTranscripts } from "../ingestion/chunker.js";
import { ingestChunks } from "../ingestion/embedder.js";
import { getTeacher } from "../config.js";

const router = Router();

router.post("/ingest", async (req: Request, res: Response) => {
  const { teacherId } = req.body;

  if (!teacherId) {
    res.status(400).json({ error: "teacherId is required" });
    return;
  }

  const teacher = getTeacher(teacherId);
  if (!teacher) {
    res.status(404).json({ error: `Teacher "${teacherId}" not found` });
    return;
  }

  try {
    console.log(`Ingesting ${teacher.name}...`);
    const chunks = chunkAllTranscripts(teacher.id);
    await ingestChunks(chunks, teacher.collectionName);
    res.json({ success: true, chunks: chunks.length });
  } catch (err) {
    console.error("Ingestion error:", err);
    res.status(500).json({ error: "Ingestion failed" });
  }
});

export default router;
