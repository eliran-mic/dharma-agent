import { detectLanguage, type Language } from "./language-detect.js";
import {
  generateTeacherResponse,
  generateUnifiedResponse,
} from "./teacher-agent.js";
import { retrieveWithEmbedding } from "./retriever.js";
import { embedQuery } from "../ingestion/embedder.js";
import type { Message } from "./llm-client.js";
import { getHistory, addMessage } from "./conversation-store.js";
import { getAllTeachers, type TeacherConfig } from "../config.js";

export interface RoomResponse {
  messages: Array<{ teacher: string; text: string }>;
  needsInput: boolean;
  clarifyQuestion?: string;
}

export async function processStudentMessage(
  userId: string,
  message: string
): Promise<RoomResponse> {
  const language = detectLanguage(message);
  const teachers = getAllTeachers();
  const history = getHistory(userId);

  // Add student message to history
  addMessage(userId, { role: "user", content: message });

  if (teachers.length === 1) {
    return singleTeacherMode(teachers[0], message, history, language, userId);
  }

  return multiTeacherMode(teachers, message, history, language, userId);
}

async function singleTeacherMode(
  teacher: TeacherConfig,
  message: string,
  history: Message[],
  language: Language,
  userId: string
): Promise<RoomResponse> {
  const response = await generateTeacherResponse(
    teacher,
    message,
    history,
    language
  );

  addMessage(userId, { role: "assistant", content: response.text });

  const hasQuestion = containsQuestion(response.text);

  return {
    messages: [{ teacher: response.teacherName, text: response.text }],
    needsInput: hasQuestion,
    clarifyQuestion: hasQuestion ? response.text : undefined,
  };
}

async function multiTeacherMode(
  teachers: TeacherConfig[],
  message: string,
  history: Message[],
  language: Language,
  userId: string
): Promise<RoomResponse> {
  // 1. Embed query ONCE
  const queryEmbedding = await embedQuery(message);

  // 2. Retrieve from all teacher collections IN PARALLEL (same embedding, no extra embed calls)
  const teacherChunks = await Promise.all(
    teachers.map(async (teacher) => ({
      teacher,
      chunks: await retrieveWithEmbedding(
        queryEmbedding,
        teacher.collectionName
      ),
    }))
  );

  // 3. Single LLM call with all teachers' contexts
  const responseMessages = await generateUnifiedResponse(
    teachers,
    teacherChunks,
    message,
    history,
    language
  );

  // 4. Store combined response in history
  const combinedText = responseMessages
    .map((m) => `${m.teacher}: ${m.text}`)
    .join("\n\n");
  addMessage(userId, { role: "assistant", content: combinedText });

  const hasQuestion = responseMessages.some((m) => containsQuestion(m.text));

  return {
    messages: responseMessages,
    needsInput: hasQuestion,
    clarifyQuestion: hasQuestion
      ? responseMessages.find((m) => containsQuestion(m.text))?.text
      : undefined,
  };
}

function containsQuestion(text: string): boolean {
  return text.includes("?") || text.includes("׃");
}
