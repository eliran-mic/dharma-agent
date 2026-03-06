import dotenv from "dotenv";
import path from "path";

dotenv.config();

export const config = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  port: parseInt(process.env.PORT || "3000", 10),
  chromaDbPath: path.resolve(process.env.CHROMA_DB_PATH || "./data/chroma_db"),
  transcriptsPath: path.resolve(
    process.env.TRANSCRIPTS_PATH || "./data/transcripts"
  ),
  embeddingModel: "Xenova/multilingual-e5-large",
  llmModel: "claude-sonnet-4-20250514",
  chunkTargetChars: 1000,
  chunkMinChars: 600,
  chunkMaxChars: 1400,
  chunkOverlapChars: 200,
  retrievalTopK: 5,
  maxConversationHistory: 10,
  maxDiscussionRounds: 3,
};

export interface TeacherConfig {
  id: string;
  name: string;
  hebrewName: string;
  collectionName: string;
  transcriptsDir: string;
}

export const teacherRegistry: TeacherConfig[] = [
  {
    id: "kerem",
    name: "Vicaya",
    hebrewName: "ויצ'איה",
    collectionName: "kerem_teachings",
    transcriptsDir: "kerem",
  },
  {
    id: "shimi",
    name: "Viriya",
    hebrewName: "וירייה",
    collectionName: "shimi_teachings",
    transcriptsDir: "shimi",
  },
  {
    id: "shachar",
    name: "Samādhi",
    hebrewName: "סמאדי",
    collectionName: "shachar_teachings",
    transcriptsDir: "shachar",
  },
  {
    id: "sati",
    name: "Upekkhā",
    hebrewName: "אופקהא",
    collectionName: "sati_teachings",
    transcriptsDir: "sati",
  },
  {
    id: "stephen",
    name: "Pīti",
    hebrewName: "פיטי",
    collectionName: "stephen_teachings",
    transcriptsDir: "stephen",
  },
];

export function getTeacher(id: string): TeacherConfig | undefined {
  return teacherRegistry.find((t) => t.id === id);
}

export function getAllTeachers(): TeacherConfig[] {
  return teacherRegistry;
}
