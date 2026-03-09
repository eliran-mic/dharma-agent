import express from "express";
import { Telegraf } from "telegraf";
import { config } from "../config.js";
import { processStudentMessage } from "../core/room-manager.js";
import { embedQuery } from "../ingestion/embedder.js";


const bot = new Telegraf(config.telegramBotToken);
const app = express();

const WELCOME_MESSAGE = `שלום וברוכים הבאים 🙏

אני מורה דרמה דיגיטלי, מבוסס על תורתה של ויצ'איה ומסורת הויפסנה.

אפשר לשאול אותי על מדיטציה, תרגול ויפסנה, או כל שאלה בנושא הדרמה.

Hello and welcome 🙏

I am a digital dharma guide, grounded in the teachings of Vicaya and the Vipassana tradition.

Feel free to ask me about meditation, Vipassana practice, or any dharma-related question.`;

bot.catch((err: any, ctx: any) => {
  console.error("Telegraf error:", err);
});

bot.start((ctx) => ctx.reply(WELCOME_MESSAGE));

bot.help((ctx) =>
  ctx.reply(
    "Simply send me a message with your question about dharma, meditation, or mindfulness practice. I'll respond in the language you write in (Hebrew or English).\n\nפשוט שלחו לי הודעה עם השאלה שלכם על דרמה, מדיטציה או תרגול קשיבות. אני אענה בשפה שבה תכתבו."
  )
);

bot.on("text", async (ctx) => {
  const userId = String(ctx.from.id);
  const message = ctx.message.text;

  // Detect language for the acknowledgment message
  const hebrewChars = (message.match(/[\u0590-\u05FF]/g) || []).length;
  const isHebrew = hebrewChars > (message.match(/[a-zA-Z]/g) || []).length;

  // Send immediate acknowledgment so the user knows we're working
  const ackMessage = isHebrew
    ? "🙏 המורים מתכנסים לדיון... אנא המתינו"
    : "🙏 The teachers are gathering... please wait";
  const ack = await ctx.reply(ackMessage);

  // Keep typing indicator alive during processing (expires after ~5s)
  const typingInterval = setInterval(() => {
    ctx.sendChatAction("typing").catch(() => {});
  }, 4000);

  try {
    const result = await processStudentMessage(userId, message);

    // Delete the acknowledgment message
    await ctx.deleteMessage(ack.message_id).catch(() => {});

    // Combine all teacher responses into a single message
    const combined = result.messages
      .map((msg) => `🧘 *${msg.teacher}*\n${msg.text}`)
      .join("\n\n───────────────\n\n");

    // Telegram has a 4096 char limit per message
    if (combined.length > 4000) {
      const parts = splitMessage(combined, 4000);
      for (const part of parts) {
        await ctx.reply(part, { parse_mode: "Markdown" }).catch(() =>
          ctx.reply(part)
        );
      }
    } else {
      await ctx.reply(combined, { parse_mode: "Markdown" }).catch(() =>
        ctx.reply(combined)
      );
    }
  } catch (err) {
    console.error("Telegram handler error:", err);
    await ctx.deleteMessage(ack.message_id).catch(() => {});
    await ctx.reply(
      "I'm sorry, something went wrong. Please try again.\nסליחה, משהו השתבש. אנא נסו שוב."
    );
  } finally {
    clearInterval(typingInterval);
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

// Health check endpoint (required for Cloud Run)
app.get("/health", async (_req, res) => {
  const { checkChromaHealth } = await import("../core/retriever.js");
  const chromaOk = await checkChromaHealth();
  const status = chromaOk ? "ok" : "degraded";
  const code = chromaOk ? 200 : 503;
  res.status(code).json({ status, chroma: chromaOk });
});

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const PORT = parseInt(process.env.PORT || String(config.port), 10);

if (WEBHOOK_URL) {
  // Production: webhook mode for Cloud Run
  const webhookPath = `/telegram/${config.telegramBotToken}`;
  app.use(express.json());
  app.post(webhookPath, (req, res) => {
    bot.handleUpdate(req.body, res);
  });

  app.listen(PORT, async () => {
    console.log(`Dharma bot listening on port ${PORT}`);

    // Warm up the embedding model so first request isn't slow
    console.log("Warming up embedding model...");
    try {
      await embedQuery("warmup");
      console.log("Embedding model ready.");
    } catch (err) {
      console.error("Failed to warm up embedding model:", err);
    }

    bot.telegram.setWebhook(`${WEBHOOK_URL}${webhookPath}`).then(() => {
      console.log(`Webhook set to ${WEBHOOK_URL}${webhookPath}`);
    });
  });
} else {
  // Development: polling mode
  console.log("Starting Telegram bot (polling mode)...");
  bot.launch();
}

// Graceful shutdown (bot.stop() only works in polling mode)
process.once("SIGINT", () => { try { bot.stop("SIGINT"); } catch {} });
process.once("SIGTERM", () => { try { bot.stop("SIGTERM"); } catch {} });
