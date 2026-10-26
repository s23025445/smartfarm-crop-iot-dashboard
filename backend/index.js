import express from "express";
import cors from "cors";
import "dotenv/config";
import { initializeDatabase } from "./db.js";

initializeDatabase();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api", (req, res) => {
  res.json({ message: "API is running!" });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
