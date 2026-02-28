import fs from "fs";
import path from "path";
import { config } from "../config.js";

interface Segment {
  start: number;
  end: number;
  text: string;
}

interface TranscriptFile {
  filename: string;
  text: string;
  segments: Segment[];
}

export interface Chunk {
  text: string;
  sourceFile: string;
  teacherId: string;
  startTime: number;
  endTime: number;
  chunkIndex: number;
}

export function chunkTranscript(
  data: TranscriptFile,
  teacherId: string
): Chunk[] {
  const { segments, filename } = data;
  if (!segments || segments.length === 0) return [];

  const {
    chunkTargetChars: target,
    chunkMinChars: min,
    chunkMaxChars: max,
    chunkOverlapChars: overlap,
  } = config;

  const chunks: Chunk[] = [];
  let currentText = "";
  let currentStart = segments[0].start;
  let segStartIdx = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    currentText += " " + seg.text.trim();

    const nextGap =
      i + 1 < segments.length ? segments[i + 1].start - seg.end : 999;
    const atNaturalPause = nextGap > 2.0;
    const reachedTarget = currentText.length >= target;
    const reachedMax = currentText.length >= max;

    if ((reachedTarget && atNaturalPause) || reachedMax) {
      chunks.push({
        text: currentText.trim(),
        sourceFile: filename,
        teacherId,
        startTime: currentStart,
        endTime: seg.end,
        chunkIndex: chunks.length,
      });

      // Compute overlap: walk backwards to find ~overlap chars
      const overlapStart = findOverlapStart(segments, i, overlap);
      segStartIdx = overlapStart;
      currentText = segments
        .slice(overlapStart, i + 1)
        .map((s) => s.text.trim())
        .join(" ");
      currentStart = segments[overlapStart].start;
    }
  }

  // Don't forget the last chunk
  if (currentText.trim().length >= min) {
    chunks.push({
      text: currentText.trim(),
      sourceFile: data.filename,
      teacherId,
      startTime: currentStart,
      endTime: segments[segments.length - 1].end,
      chunkIndex: chunks.length,
    });
  }

  return chunks;
}

function findOverlapStart(
  segments: Segment[],
  endIdx: number,
  overlapChars: number
): number {
  let charCount = 0;
  for (let i = endIdx; i >= 0; i--) {
    charCount += segments[i].text.length + 1;
    if (charCount >= overlapChars) return i;
  }
  return 0;
}

export function loadTranscripts(teacherId: string): TranscriptFile[] {
  const dir = path.join(config.transcriptsPath, teacherId);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  return files.map((f) => {
    const content = fs.readFileSync(path.join(dir, f), "utf-8");
    return JSON.parse(content) as TranscriptFile;
  });
}

export function chunkAllTranscripts(teacherId: string): Chunk[] {
  const transcripts = loadTranscripts(teacherId);
  const allChunks: Chunk[] = [];
  for (const transcript of transcripts) {
    const chunks = chunkTranscript(transcript, teacherId);
    allChunks.push(...chunks);
  }
  return allChunks;
}
