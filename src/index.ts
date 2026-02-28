import express from "express";
import { config } from "./config.js";
import chatRouter from "./routes/chat.js";
import adminRouter from "./routes/admin.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/chat", chatRouter);
app.use("/api/admin", adminRouter);

app.listen(config.port, () => {
  console.log(`Dharma Agent API running on port ${config.port}`);
});
