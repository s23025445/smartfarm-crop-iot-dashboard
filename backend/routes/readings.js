import { Router } from "express";
import { readSensorReadings } from "../utils/sensorData.js";

const router = Router();

// Read the file again for every request so changes appear immediately.
router.get("/", async (req, res) => {
  try {
    const readings = await readSensorReadings();
    res.status(200).json(readings);
  } catch {
    const error = new Error("Sensor data file is invalid");
    error.status = 500;
    throw error;
  }
});

export default router;
