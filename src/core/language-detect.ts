export type Language = "hebrew" | "english";

export function detectLanguage(text: string): Language {
  const hebrewChars = (text.match(/[\u0590-\u05FF]/g) || []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
  return hebrewChars > latinChars ? "hebrew" : "english";
}
