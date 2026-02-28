import { Router, type Request, type Response } from "express";
import { processStudentMessage } from "../core/room-manager.js";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  const { message, userId } = req.body;

  if (!message || !userId) {
    res.status(400).json({ error: "message and userId are required" });
    return;
  }

  try {
    const result = await processStudentMessage(String(userId), String(message));
    res.json(result);
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
