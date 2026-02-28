import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function chat(
  systemPrompt: string,
  messages: Message[],
  maxTokens: number = 1024
): Promise<string> {
  const response = await client.messages.create({
    model: config.llmModel,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.text || "";
}
