import { Router, type Request, type Response } from "express";
import { processStudentMessage } from "../core/room-manager.js";
import { setSelectedTeacher } from "../core/teacher-preference.js";
import { getAllTeachers } from "../config.js";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  const { message, userId, teacherId } = req.body;

  if (!message || !userId) {
    res.status(400).json({ error: "message and userId are required" });
    return;
  }

  // Allow API callers to specify a teacher per request
  if (teacherId !== undefined) {
    setSelectedTeacher(String(userId), teacherId || null);
  }

  try {
    const result = await processStudentMessage(String(userId), String(message));
    res.json(result);
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// List available teachers with their descriptions
router.get("/teachers", (_req: Request, res: Response) => {
  const teachers = getAllTeachers().map((t) => ({
    id: t.id,
    name: t.name,
    hebrewName: t.hebrewName,
    essence: t.essence,
    hebrewEssence: t.hebrewEssence,
  }));
  res.json({ teachers });
});

export default router;
