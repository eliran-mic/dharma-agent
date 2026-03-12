const PREFERENCE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface Preference {
  teacherId: string | null; // null = all teachers
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

export function getSelectedTeacher(userId: string): string | null {
  const pref = preferences.get(userId);
  if (pref) {
    pref.lastAccess = Date.now();
    return pref.teacherId;
  }
  return null; // default: all teachers
}

/**
 * Set the selected teacher for a user.
 * Returns true if the selection actually changed (useful for clearing history).
 */
export function setSelectedTeacher(
  userId: string,
  teacherId: string | null
): boolean {
  const prev = preferences.get(userId);
  const changed = !prev || prev.teacherId !== teacherId;
  preferences.set(userId, { teacherId, lastAccess: Date.now() });
  return changed;
}
