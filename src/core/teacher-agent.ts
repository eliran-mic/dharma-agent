import type { RetrievedChunk } from "./retriever.js";
import { chat, type Message } from "./llm-client.js";
import { getBaseTeacherPrompt } from "../prompts/base-teacher-prompt.js";
import type { TeacherConfig } from "../config.js";
import type { Language } from "./language-detect.js";

// Dynamic import for teacher-specific prompts
const promptModules: Record<string, () => Promise<string>> = {
  kerem: async () => {
    const mod = await import("../prompts/kerem-prompt.js");
    return mod.keremPrompt;
  },
  shimi: async () => {
    const mod = await import("../prompts/shimi-prompt.js");
    return mod.shimiPrompt;
  },
  shachar: async () => {
    const mod = await import("../prompts/shachar-prompt.js");
    return mod.shacharPrompt;
  },
  sati: async () => {
    const mod = await import("../prompts/sati-prompt.js");
    return mod.satiPrompt;
  },
  stephen: async () => {
    const mod = await import("../prompts/stephen-prompt.js");
    return mod.stephenPrompt;
  },
};

export interface TeacherResponse {
  teacherId: string;
  teacherName: string;
  text: string;
  retrievedChunks: RetrievedChunk[];
}

/** Single-teacher response (used when only 1 teacher is configured). */
export async function generateTeacherResponse(
  teacher: TeacherConfig,
  studentMessage: string,
  conversationHistory: Message[],
  language: Language
): Promise<TeacherResponse> {
  // This path is only used for single-teacher mode; embedding is done inside retrieveChunks
  const { retrieveChunks } = await import("./retriever.js");
  const chunks = await retrieveChunks(studentMessage, teacher.collectionName);

  const basePrompt = getBaseTeacherPrompt(language);
  const teacherPromptFn = promptModules[teacher.id];
  const teacherPrompt = teacherPromptFn ? await teacherPromptFn() : "";

  let contextSection = "";
  if (chunks.length > 0) {
    const excerpts = chunks
      .map((c, i) => `[Excerpt ${i + 1}]: ${c.text}`)
      .join("\n\n");
    contextSection = `\n\n## Relevant Excerpts from Your Teachings\n${excerpts}`;
  }

  const systemPrompt = `${teacherPrompt}\n\n${basePrompt}${contextSection}`;

  const messages: Message[] = [
    ...conversationHistory,
    { role: "user", content: studentMessage },
  ];

  const response = await chat(systemPrompt, messages);

  return {
    teacherId: teacher.id,
    teacherName: language === "hebrew" ? teacher.hebrewName : teacher.name,
    text: response,
    retrievedChunks: chunks,
  };
}

/**
 * Unified multi-teacher response: 1 LLM call that generates all teachers' perspectives.
 * Expects chunks to be pre-retrieved (embedding done once upstream).
 */
export async function generateUnifiedResponse(
  teachers: TeacherConfig[],
  teacherChunks: Array<{ teacher: TeacherConfig; chunks: RetrievedChunk[] }>,
  studentMessage: string,
  conversationHistory: Message[],
  language: Language
): Promise<Array<{ teacher: string; text: string }>> {
  const basePrompt = getBaseTeacherPrompt(language);

  // Build per-teacher sections with their persona + retrieved context
  const teacherSections = await Promise.all(
    teacherChunks.map(async ({ teacher, chunks }) => {
      const promptFn = promptModules[teacher.id];
      const teacherPrompt = promptFn ? await promptFn() : "";
      const name = language === "hebrew" ? teacher.hebrewName : teacher.name;

      let excerpts = "(No relevant excerpts found)";
      if (chunks.length > 0) {
        excerpts = chunks
          .map((c, i) => `[Excerpt ${i + 1}]: ${c.text}`)
          .join("\n\n");
      }

      return `### ${name} (${teacher.id})\n${teacherPrompt}\n\n#### Relevant excerpts from ${name}'s teachings:\n${excerpts}`;
    })
  );

  const teacherNames = teachers.map((t) =>
    language === "hebrew" ? t.hebrewName : t.name
  );

  const systemPrompt = `You are generating a dharma discussion room where ${teachers.length} teachers each respond to a student's question. Each teacher has a unique perspective, teaching style, and their own body of recorded teachings.

${basePrompt}

---

## The Teachers

${teacherSections.join("\n\n---\n\n")}

---

## Instructions

Respond as ALL ${teachers.length} teachers. Each teacher should:
- Speak in their unique voice and teaching style
- Draw naturally from their specific teaching excerpts when relevant
- Build on previous teachers' responses — complement, don't repeat
- Keep each response focused and concise (2-4 paragraphs)
- ${language === "hebrew" ? "Respond entirely in Hebrew" : "Respond in English"}

## Response Format

You MUST respond with a JSON array. Each element has "teacher" (exact name) and "text" (the response).
Teachers in order: ${teacherNames.map((n) => `"${n}"`).join(", ")}

Example format:
[{"teacher":"${teacherNames[0]}","text":"..."},{"teacher":"${teacherNames[1]}","text":"..."}]`;

  const messages: Message[] = [
    ...conversationHistory,
    { role: "user", content: studentMessage },
  ];

  const response = await chat(systemPrompt, messages, 4096);

  // Try to parse the full JSON array
  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        teacher: string;
        text: string;
      }>;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Failed to parse unified response JSON, attempting partial recovery...");
  }

  // Try to recover individual teacher responses from truncated JSON
  const recovered = recoverPartialResponses(response, teacherNames);
  if (recovered.length > 0) {
    return recovered;
  }

  // Last resort: return the raw response with JSON artifacts stripped
  const fallbackName =
    language === "hebrew" ? teachers[0].hebrewName : teachers[0].name;
  const cleanText = response
    .replace(/^\s*\[?\s*\{?\s*"teacher"\s*:\s*"[^"]*"\s*,\s*"text"\s*:\s*"?/i, "")
    .replace(/"\s*}\s*,?\s*\{?\s*"teacher"[\s\S]*$/i, "")
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .trim();
  return [{ teacher: fallbackName, text: cleanText || response }];
}

/**
 * Extract as many complete teacher responses as possible from truncated JSON.
 * Matches individual {"teacher":"...","text":"..."} objects even if the array is incomplete.
 */
function recoverPartialResponses(
  raw: string,
  teacherNames: string[]
): Array<{ teacher: string; text: string }> {
  const results: Array<{ teacher: string; text: string }> = [];

  for (const name of teacherNames) {
    // Match this teacher's object — greedy up to the next teacher object or end
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      `"teacher"\\s*:\\s*"${escapedName}"\\s*,\\s*"text"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`
    );
    const match = raw.match(pattern);
    if (match) {
      const text = match[1]
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
      results.push({ teacher: name, text });
    }
  }

  return results;
}
