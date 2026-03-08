import { config } from "../config.js";
import type { Message } from "./llm-client.js";

interface StoreEntry {
  messages: Message[];
  lastAccess: number;
}

const USER_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_USERS = 10_000;

const store = new Map<string, StoreEntry>();

// Evict expired users every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.lastAccess > USER_TTL_MS) {
      store.delete(key);
    }
  }
}, 60 * 60 * 1000).unref();

export function getHistory(userId: string): Message[] {
  const entry = store.get(userId);
  if (entry) {
    entry.lastAccess = Date.now();
    return entry.messages;
  }
  return [];
}

export function addMessage(userId: string, message: Message): void {
  let entry = store.get(userId);
  if (!entry) {
    // Evict oldest user if at capacity
    if (store.size >= MAX_USERS) {
      let oldestKey: string | undefined;
      let oldestTime = Infinity;
      for (const [key, e] of store) {
        if (e.lastAccess < oldestTime) {
          oldestTime = e.lastAccess;
          oldestKey = key;
        }
      }
      if (oldestKey) store.delete(oldestKey);
    }
    entry = { messages: [], lastAccess: Date.now() };
    store.set(userId, entry);
  }

  entry.messages.push(message);
  entry.lastAccess = Date.now();

  // Keep only the last N messages
  if (entry.messages.length > config.maxConversationHistory) {
    entry.messages.splice(0, entry.messages.length - config.maxConversationHistory);
  }
}

export function clearHistory(userId: string): void {
  store.delete(userId);
}
