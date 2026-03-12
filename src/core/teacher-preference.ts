const PREFERENCE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type Language = "hebrew" | "english";

interface Preference {
  teacherId: string | null; // null = all teachers
  language: Language;
  lastAccess: number;
}

const preferences = new Map<string, Preference>();

// Evict expired preferences every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, pref] of preferences) {
    if (now - pref.lastAccess > PREFERENCE_TTL_MS) {
      preferences.delete(key);
    }
  }
}, 60 * 60 * 1000).unref();

function getOrCreate(userId: string): Preference {
  let pref = preferences.get(userId);
  if (!pref) {
    pref = { teacherId: null, language: "hebrew", lastAccess: Date.now() };
    preferences.set(userId, pref);
  }
  pref.lastAccess = Date.now();
  return pref;
}

export function getSelectedTeacher(userId: string): string | null {
  return getOrCreate(userId).teacherId;
}

/**
 * Set the selected teacher for a user.
 * Returns true if the selection actually changed (useful for clearing history).
 */
export function setSelectedTeacher(
  userId: string,
  teacherId: string | null
): boolean {
  const pref = getOrCreate(userId);
  const changed = pref.teacherId !== teacherId;
  pref.teacherId = teacherId;
  return changed;
}

export function getLanguage(userId: string): Language {
  return getOrCreate(userId).language;
}

export function setLanguage(userId: string, language: Language): void {
  getOrCreate(userId).language = language;
}
