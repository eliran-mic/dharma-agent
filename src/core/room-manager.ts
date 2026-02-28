import { detectLanguage, type Language } from "./language-detect.js";
import {
  generateTeacherResponse,
  type TeacherResponse,
} from "./teacher-agent.js";
import { chat, type Message } from "./llm-client.js";
import {
  getHistory,
  addMessage,
} from "./conversation-store.js";
import { getAllTeachers, config, type TeacherConfig } from "../config.js";
import { roomOrchestratorPrompt } from "../prompts/room-prompt.js";

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

  // Add assistant response to history
  addMessage(userId, { role: "assistant", content: response.text });

  // Check if the teacher asked a clarifying question
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
  const allMessages: Array<{ teacher: string; text: string }> = [];
  let previousResponses: TeacherResponse[] = [];

  for (let round = 0; round < config.maxDiscussionRounds; round++) {
    // Each teacher responds (in parallel for round 1, sequential for follow-ups)
    const roundResponses: TeacherResponse[] = [];

    if (round === 0) {
      // Round 1: all teachers respond in parallel
      const promises = teachers.map((teacher) =>
        generateTeacherResponse(teacher, message, history, language)
      );
      const responses = await Promise.all(promises);
      roundResponses.push(...responses);
    } else {
      // Subsequent rounds: teachers see previous responses
      for (const teacher of teachers) {
        const otherResponses = previousResponses.filter(
          (r) => r.teacherId !== teacher.id
        );
        const response = await generateTeacherResponse(
          teacher,
          message,
          history,
          language,
          otherResponses
        );
        roundResponses.push(response);
      }
    }

    for (const r of roundResponses) {
      allMessages.push({ teacher: r.teacherName, text: r.text });
    }
    previousResponses = roundResponses;

    // Ask the orchestrator if we should continue
    const decision = await getOrchestratorDecision(
      message,
      allMessages,
      round + 1
    );

    if (decision.action === "clarify") {
      // Combine all messages so far and indicate we need student input
      const combinedText = allMessages
        .map((m) => `${m.teacher}: ${m.text}`)
        .join("\n\n");
      addMessage(userId, { role: "assistant", content: combinedText });

      return {
        messages: allMessages,
        needsInput: true,
        clarifyQuestion: decision.clarifyQuestion,
      };
    }

    if (decision.action === "done") {
      break;
    }
  }

  // Store the combined response in history
  const combinedText = allMessages
    .map((m) => `${m.teacher}: ${m.text}`)
    .join("\n\n");
  addMessage(userId, { role: "assistant", content: combinedText });

  return {
    messages: allMessages,
    needsInput: false,
  };
}

interface OrchestratorDecision {
  action: "done" | "continue" | "clarify";
  reason: string;
  clarifyQuestion?: string;
}

async function getOrchestratorDecision(
  studentMessage: string,
  responses: Array<{ teacher: string; text: string }>,
  roundNumber: number
): Promise<OrchestratorDecision> {
  if (roundNumber >= config.maxDiscussionRounds) {
    return { action: "done", reason: "max rounds reached" };
  }

  const conversationSummary = responses
    .map((r) => `${r.teacher}: ${r.text}`)
    .join("\n\n");

  const prompt = `Student asked: "${studentMessage}"\n\nTeacher responses so far (round ${roundNumber}):\n${conversationSummary}\n\nWhat should happen next? Respond with JSON only.`;

  try {
    const result = await chat(roomOrchestratorPrompt, [
      { role: "user", content: prompt },
    ], 200);
    const parsed = JSON.parse(result);
    return parsed as OrchestratorDecision;
  } catch {
    return { action: "done", reason: "parsing failed, defaulting to done" };
  }
}

function containsQuestion(text: string): boolean {
  // Check for question marks in Hebrew or English
  return text.includes("?") || text.includes("׃");
}
