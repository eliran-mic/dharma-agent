import { retrieveChunks, type RetrievedChunk } from "./retriever.js";
import { chat, type Message } from "./llm-client.js";
import { getBaseTeacherPrompt } from "../prompts/base-teacher-prompt.js";
import type { TeacherConfig } from "../config.js";
import type { Language } from "./language-detect.js";

// Dynamic import for teacher-specific prompts
const promptModules: Record<string, () => Promise<string>> = {
  keren: async () => {
    const mod = await import("../prompts/keren-prompt.js");
    return mod.kerenPrompt;
  },
};

export interface TeacherResponse {
  teacherId: string;
  teacherName: string;
  text: string;
  retrievedChunks: RetrievedChunk[];
}

export async function generateTeacherResponse(
  teacher: TeacherConfig,
  studentMessage: string,
  conversationHistory: Message[],
  language: Language,
  otherTeacherResponses: TeacherResponse[] = []
): Promise<TeacherResponse> {
  // Retrieve relevant teachings
  const chunks = await retrieveChunks(studentMessage, teacher.collectionName);

  // Build the system prompt
  const basePrompt = getBaseTeacherPrompt(language);
  const teacherPromptFn = promptModules[teacher.id];
  const teacherPrompt = teacherPromptFn ? await teacherPromptFn() : "";

  let contextSection = "";
  if (chunks.length > 0) {
    const excerpts = chunks
      .map(
        (c, i) =>
          `[Excerpt ${i + 1}]: ${c.text}`
      )
      .join("\n\n");
    contextSection = `\n\n## Relevant Excerpts from Your Teachings\n${excerpts}`;
  }

  let otherResponsesSection = "";
  if (otherTeacherResponses.length > 0) {
    const others = otherTeacherResponses
      .map((r) => `${r.teacherName}: ${r.text}`)
      .join("\n\n");
    otherResponsesSection = `\n\n## What Other Teachers Have Said\n${others}`;
  }

  const systemPrompt = `${teacherPrompt}\n\n${basePrompt}${contextSection}${otherResponsesSection}`;

  // Build messages including conversation history
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
