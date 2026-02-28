import { Telegraf } from "telegraf";
import { config } from "../config.js";
import { processStudentMessage } from "../core/room-manager.js";

const bot = new Telegraf(config.telegramBotToken);

const WELCOME_MESSAGE = `שלום וברוכים הבאים 🙏

אני מורה דרמה דיגיטלי, מבוסס על תורתה של קרן ארבל ומסורת הויפסנה של תובנה.

אפשר לשאול אותי על מדיטציה, תרגול ויפסנה, או כל שאלה בנושא הדרמה.

Hello and welcome 🙏

I am a digital dharma guide, grounded in the teachings of Keren Arbel and the Tovana Vipassana tradition.

Feel free to ask me about meditation, Vipassana practice, or any dharma-related question.`;

bot.start((ctx) => ctx.reply(WELCOME_MESSAGE));

bot.help((ctx) =>
  ctx.reply(
    "Simply send me a message with your question about dharma, meditation, or mindfulness practice. I'll respond in the language you write in (Hebrew or English).\n\nפשוט שלחו לי הודעה עם השאלה שלכם על דרמה, מדיטציה או תרגול קשיבות. אני אענה בשפה שבה תכתבו."
  )
);

bot.on("text", async (ctx) => {
  const userId = String(ctx.from.id);
  const message = ctx.message.text;

  // Show typing indicator
  await ctx.sendChatAction("typing");

  try {
    const result = await processStudentMessage(userId, message);

    // Format response with teacher names
    for (const msg of result.messages) {
      const formatted = `🧘 ${msg.teacher}: ${msg.text}`;

      // Telegram has a 4096 char limit per message
      if (formatted.length > 4000) {
        const chunks = splitMessage(formatted, 4000);
        for (const chunk of chunks) {
          await ctx.reply(chunk);
        }
      } else {
        await ctx.reply(formatted);
      }
    }
  } catch (err) {
    console.error("Telegram handler error:", err);
    await ctx.reply(
      "I'm sorry, something went wrong. Please try again.\nסליחה, משהו השתבש. אנא נסו שוב."
    );
  }
});

function splitMessage(text: string, maxLength: number): string[] {
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      parts.push(remaining);
      break;
    }
    // Try to split at a newline or space near the limit
    let splitIdx = remaining.lastIndexOf("\n", maxLength);
    if (splitIdx < maxLength * 0.5) {
      splitIdx = remaining.lastIndexOf(" ", maxLength);
    }
    if (splitIdx < maxLength * 0.5) {
      splitIdx = maxLength;
    }
    parts.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx).trimStart();
  }
  return parts;
}

// Start the bot
console.log("Starting Telegram bot...");
bot.launch();

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
