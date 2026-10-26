import "dotenv/config";
import cors from "cors";
import express from "express";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeDatabase } from "./db.js";
import cropRoutes from "./routes/crops.js";
import readingRoutes from "./routes/readings.js";

initializeDatabase();

const app = express();

// Allow frontend requests and read JSON request bodies.
app.use(cors());
app.use(express.json());

// A small route to check if the API is running.
app.get("/api", (req, res) => {
  res.json({ message: "API is running!" });
});

app.use("/api/readings", readingRoutes);
app.use("/api/crops", cropRoutes);

// Return JSON for unknown API routes instead of Express's HTML error page.
app.use("/api", (req, res) => {
  res.status(404).json({ error: "API route not found" });
});

// Handle errors from all routes and always send JSON.
app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof SyntaxError && error.status === 400) {
    return res.status(400).json({ error: "Request body contains invalid JSON" });
  }

  if (error.status) {
    return res.status(error.status).json({ error: error.message });
  }

  return res.status(500).json({ error: "Internal server error" });
});

// Export the app so the test files can use it.
export default app;

// Start the server only when this file is run with "node server.js".
// This stops the server from starting automatically during tests.
const isMainFile =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainFile) {
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
