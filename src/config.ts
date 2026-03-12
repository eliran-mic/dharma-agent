import dotenv from "dotenv";
import path from "path";

dotenv.config();

export const config = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  port: parseInt(process.env.PORT || "3000", 10),
  chromaDbUrl: process.env.CHROMA_DB_URL || "http://localhost:8000",
  chromaDbPath: path.resolve(process.env.CHROMA_DB_PATH || "./data/chroma_db"),
  transcriptsPath: path.resolve(
    process.env.TRANSCRIPTS_PATH || "./data/transcripts"
  ),
  embeddingModel: "Xenova/multilingual-e5-small",
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
  essence: string;
  hebrewEssence: string;
}

export const teacherRegistry: TeacherConfig[] = [
  {
    id: "kerem",
    name: "Vicaya",
    hebrewName: "ויצ'איה",
    collectionName: "keren_teachings",
    transcriptsDir: "kerem",
    essence:
      "A contemplative philosopher who uses rigorous inquiry to help you see through habitual mental constructs. Combines academic depth in Buddhist studies with warm, accessible teaching. Specializes in jhanas, the six elements, and the interplay of calm and insight.",
    hebrewEssence:
      "פילוסוף מתבונן המשתמש בחקירה מעמיקה כדי לעזור לך לראות מעבר למבנים המנטליים ההרגליים. משלב עומק אקדמי בלימודי בודהיזם עם הוראה חמה ונגישה. מתמחה בג'אנות, ששת היסודות, והיחס בין שקט לתובנה.",
  },
  {
    id: "shimi",
    name: "Viriya",
    hebrewName: "וירייה",
    collectionName: "shimi_teachings",
    transcriptsDir: "shimi",
    essence:
      "A heart-centered teacher who brings ancient dharma alive through intimate storytelling and warm presence. Master of loving-kindness and forgiveness practices. Guides you toward freedom by helping you lovingly recognize the patterns that create suffering.",
    hebrewEssence:
      "מורה שמרכזו בלב, המחייה את הדהרמה העתיקה דרך סיפור אישי ונוכחות חמה. מומחה בתרגולי אהבה-חסד וסליחה. מנחה אותך לחופש בעזרת זיהוי אוהב של הדפוסים שיוצרים סבל.",
  },
  {
    id: "shachar",
    name: "Samādhi",
    hebrewName: "סמאדי",
    collectionName: "shachar_teachings",
    transcriptsDir: "shachar",
    essence:
      "A clear-eyed pragmatist who systematically guides you toward equanimous freedom through precise instruction. Teaches with methodical care, helping you build genuine resilience by learning to meet experience with steadiness, clarity, and spacious awareness.",
    hebrewEssence:
      "פרגמטיסטית בהירה המנחה אותך בשיטתיות לקראת חופש שקול דרך הוראה מדויקת. מלמדת בקפדנות שיטתית, עוזרת לך לבנות חוסן אמיתי על ידי למידה לפגוש את החוויה ביציבות, בהירות ומודעות רחבה.",
  },
  {
    id: "sati",
    name: "Upekkhā",
    hebrewName: "אופקהא",
    collectionName: "sati_teachings",
    transcriptsDir: "sati",
    essence:
      "A compassionate guide who recognizes that opening the heart is both spiritual liberation and ethical action. Teaches with warmth and directness, integrating vipassana with loving-kindness and RAIN practice. Shows how inner peace and compassion in the world are inseparable.",
    hebrewEssence:
      "מדריך חומל המכיר בכך שפתיחת הלב היא גם שחרור רוחני וגם פעולה מוסרית. מלמד בחום וישירות, משלב ויפסנה עם אהבה-חסד ותרגול RAIN. מראה כיצד שלום פנימי וחמלה בעולם הם בלתי נפרדים.",
  },
  {
    id: "stephen",
    name: "Pīti",
    hebrewName: "פיטי",
    collectionName: "stephen_teachings",
    transcriptsDir: "stephen",
    essence:
      "A founding figure of insight meditation in Israel with decades of wisdom. Bridges Eastern and Western understanding with clarity and warmth. Known for joy, deep dialogue, and teaching that kindness is not just a practice but a natural expression of understanding.",
    hebrewEssence:
      "דמות מייסדת של מדיטציית תובנה בישראל עם עשרות שנים של חוכמה. מגשר בין הבנה מזרחית ומערבית בבהירות ובחום. ידוע בשמחה, דיאלוג עמוק, והוראה שחסד הוא לא רק תרגול אלא ביטוי טבעי של הבנה.",
  },
];

export function getTeacher(id: string): TeacherConfig | undefined {
  return teacherRegistry.find((t) => t.id === id);
}

export function getAllTeachers(): TeacherConfig[] {
  return teacherRegistry;
}
