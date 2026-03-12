import express from "express";
import { Telegraf, Markup } from "telegraf";
import { config, getAllTeachers } from "../config.js";
import { processStudentMessage } from "../core/room-manager.js";
import { embedQuery } from "../ingestion/embedder.js";
import {
  getSelectedTeacher,
  setSelectedTeacher,
} from "../core/teacher-preference.js";
import { clearHistory } from "../core/conversation-store.js";

const bot = new Telegraf(config.telegramBotToken);
const app = express();

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildTeacherSelectionMessage(isHebrew: boolean) {
  const teachers = getAllTeachers();

  if (isHebrew) {
    let text = "🙏 <b>בחרו מורה לשיחה</b>\n\nבחרו מורה שתרצו לשוחח איתו, או בחרו \"כל המורים\" לקבל תשובות מכולם:\n";
    for (const t of teachers) {
      text += `\n<b>${escapeHtml(t.hebrewName)}</b> — ${escapeHtml(t.hebrewEssence)}\n`;
    }
    return text;
  }

  let text = "🙏 <b>Choose a teacher to talk with</b>\n\nSelect a teacher you'd like to have a conversation with, or choose \"All teachers\" to hear from everyone:\n";
  for (const t of teachers) {
    text += `\n<b>${escapeHtml(t.name)}</b> — ${escapeHtml(t.essence)}\n`;
  }
  return text;
}

function buildTeacherKeyboard(isHebrew: boolean) {
  const teachers = getAllTeachers();
  const buttons = teachers.map((t) =>
    Markup.button.callback(
      isHebrew ? t.hebrewName : t.name,
      `select_teacher:${t.id}`
    )
  );
  // Add "All teachers" option
  buttons.push(
    Markup.button.callback(
      isHebrew ? "🧘 כל המורים" : "🧘 All teachers",
      "select_teacher:all"
    )
  );

  // Arrange in rows of 2
  const rows: Array<ReturnType<typeof Markup.button.callback>[]> = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }
  return Markup.inlineKeyboard(rows);
}

const WELCOME_MESSAGE_HE = `שלום וברוכים הבאים 🙏

אני מורה דרמה דיגיטלי, מבוסס על מסורת הויפסנה.

בחרו מורה לשיחה אישית, או בחרו "כל המורים" כדי לקבל תשובות מכל המורים יחד.`;

const WELCOME_MESSAGE_EN = `Hello and welcome 🙏

I am a digital dharma guide, grounded in the Vipassana tradition.

Choose a teacher for a personal conversation, or select "All teachers" to hear from everyone.`;

bot.catch((err: any, ctx: any) => {
  console.error("Telegraf error:", err);
});

bot.start(async (ctx) => {
  const lang = ctx.from?.language_code;
  const isHebrew = lang === "he";

  const welcomeText = isHebrew ? WELCOME_MESSAGE_HE : WELCOME_MESSAGE_EN;
  const selectionText = buildTeacherSelectionMessage(isHebrew);
  const keyboard = buildTeacherKeyboard(isHebrew);

  await ctx.reply(welcomeText);
  await ctx.reply(selectionText, { parse_mode: "HTML", ...keyboard });
});

bot.command("choose", async (ctx) => {
  const msgText = ctx.message.text || "";
  const hebrewChars = (msgText.match(/[\u0590-\u05FF]/g) || []).length;
  const isHebrew = hebrewChars > 0 || ctx.from?.language_code === "he";

  const text = buildTeacherSelectionMessage(isHebrew);
  const keyboard = buildTeacherKeyboard(isHebrew);
  await ctx.reply(text, { parse_mode: "HTML", ...keyboard });
});

bot.help(async (ctx) => {
  const lang = ctx.from?.language_code;
  const isHebrew = lang === "he";
  const userId = String(ctx.from.id);
  const selectedId = getSelectedTeacher(userId);
  const teachers = getAllTeachers();
  const selected = selectedId
    ? teachers.find((t) => t.id === selectedId)
    : null;

  const currentHe = selected
    ? `המורה הנוכחי: *${selected.hebrewName}*`
    : "כרגע: *כל המורים*";
  const currentEn = selected
    ? `Current teacher: *${selected.name}*`
    : "Currently: *All teachers*";

  const helpText = isHebrew
    ? `שלחו הודעה עם השאלה שלכם על דרמה, מדיטציה או תרגול קשיבות.\n\n${currentHe}\n\nהשתמשו ב /choose כדי לבחור מורה אחר.`
    : `Send me a message with your question about dharma, meditation, or mindfulness practice.\n\n${currentEn}\n\nUse /choose to select a different teacher.`;

  await ctx.reply(helpText, { parse_mode: "Markdown" });
});

// Handle teacher selection callback
bot.action(/^select_teacher:(.+)$/, async (ctx) => {
  const teacherId = ctx.match[1];
  const userId = String(ctx.from.id);
  const lang = ctx.from?.language_code;
  const isHebrew = lang === "he";

  if (teacherId === "all") {
    const changed = setSelectedTeacher(userId, null);
    if (changed) clearHistory(userId);
    const text = isHebrew
      ? "🧘 מצוין! כל המורים ישתתפו בשיחה. שלחו הודעה כדי להתחיל."
      : "🧘 Great! All teachers will participate in the conversation. Send a message to begin.";
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined);
    await ctx.reply(text);
  } else {
    const teachers = getAllTeachers();
    const teacher = teachers.find((t) => t.id === teacherId);
    if (!teacher) {
      await ctx.answerCbQuery("Teacher not found");
      return;
    }

    const changed = setSelectedTeacher(userId, teacherId);
    if (changed) clearHistory(userId);
    const text = isHebrew
      ? `🙏 בחרתם ב<b>${escapeHtml(teacher.hebrewName)}</b>. שלחו הודעה כדי להתחיל שיחה.`
      : `🙏 You chose <b>${escapeHtml(teacher.name)}</b>. Send a message to start the conversation.`;
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined);
    await ctx.reply(text, { parse_mode: "HTML" });
  }
});

bot.on("text", async (ctx) => {
  const userId = String(ctx.from.id);
  const message = ctx.message.text;

  // Detect language for the acknowledgment message
  const hebrewChars = (message.match(/[\u0590-\u05FF]/g) || []).length;
  const isHebrew = hebrewChars > (message.match(/[a-zA-Z]/g) || []).length;

  // Check if user has a teacher preference
  const selectedId = getSelectedTeacher(userId);
  const teachers = getAllTeachers();
  const selectedTeacher = selectedId
    ? teachers.find((t) => t.id === selectedId)
    : null;

  // Tailored acknowledgment message
  let ackMessage: string;
  if (selectedTeacher) {
    const teacherName = isHebrew
      ? selectedTeacher.hebrewName
      : selectedTeacher.name;
    ackMessage = isHebrew
      ? `🙏 ${teacherName} מתבוננ/ת בשאלה שלך... אנא המתן/י`
      : `🙏 ${teacherName} is contemplating your question... please wait`;
  } else {
    ackMessage = isHebrew
      ? "🙏 המורים מתכנסים לדיון... אנא המתינו"
      : "🙏 The teachers are gathering... please wait";
  }
  const ack = await ctx.reply(ackMessage);

  // Keep typing indicator alive during processing
  const typingInterval = setInterval(() => {
    ctx.sendChatAction("typing").catch(() => {});
  }, 4000);

  try {
    const result = await processStudentMessage(userId, message);

    // Delete the acknowledgment message
    await ctx.deleteMessage(ack.message_id).catch(() => {});

    // Send each teacher's response as a separate message to avoid
    // truncation and broken Markdown from splitting mid-format
    for (const msg of result.messages) {
      const formatted = `🧘 <b>${escapeHtml(msg.teacher)}</b>\n\n${escapeHtml(msg.text)}`;

      if (formatted.length > 4000) {
        const parts = splitMessage(formatted, 4000);
        for (const part of parts) {
          await ctx
            .reply(part, { parse_mode: "HTML" })
            .catch(() => ctx.reply(part));
        }
      } else {
        await ctx
          .reply(formatted, { parse_mode: "HTML" })
          .catch(() => ctx.reply(formatted));
      }
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
