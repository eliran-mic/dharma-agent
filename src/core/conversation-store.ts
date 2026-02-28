import { config } from "../config.js";
import type { Message } from "./llm-client.js";

const store = new Map<string, Message[]>();

export function getHistory(userId: string): Message[] {
  return store.get(userId) || [];
}

export function addMessage(userId: string, message: Message): void {
  const history = store.get(userId) || [];
  history.push(message);

  // Keep only the last N messages
  if (history.length > config.maxConversationHistory) {
    history.splice(0, history.length - config.maxConversationHistory);
  }

  store.set(userId, history);
}

export function clearHistory(userId: string): void {
  store.delete(userId);
}
