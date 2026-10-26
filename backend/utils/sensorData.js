import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// These are the only values accepted in the sensor file.
export const allowedCrops = ["Tomato", "Lettuce", "Wheat", "Maize"];
export const requiredReadingFields = [
  "crop_name",
  "timestamp",
  "soil_moisture",
  "temperature",
  "rainfall",
  "sensor_status",
  "notes",
];

const allowedStatuses = new Set(["Online", "Offline", "Faulty"]);
const timestampPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/;

// Use a path based on this file instead of the current terminal folder.
const backendDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
export const sensorReadingsPath = join(
  backendDirectory,
  "data",
  "sensor-readings.json",
);

function isValidTimestamp(timestamp) {
  // First check the exact text format.
  const match = timestampPattern.exec(timestamp);

  if (!match) {
    return false;
  }

  const [year, month, day, hour, minute, second] = match
    .slice(1)
    .map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  // Compare every part because JavaScript can adjust impossible dates.
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day &&
    parsed.getUTCHours() === hour &&
    parsed.getUTCMinutes() === minute &&
    parsed.getUTCSeconds() === second
  );
}

export function validateSensorReadings(readings) {
  // The assignment requires exactly 20 readings in one array.
  if (!Array.isArray(readings) || readings.length !== 20) {
    throw new Error("Expected an array containing exactly 20 readings");
  }

  const cropCounts = new Map(allowedCrops.map((crop) => [crop, 0]));
  const timestampsByCrop = new Map(
    allowedCrops.map((crop) => [crop, new Set()]),
  );
  const sortedRequiredFields = [...requiredReadingFields].sort();

  for (const reading of readings) {
    // Each item must be a normal JSON object.
    if (reading === null || typeof reading !== "object" || Array.isArray(reading)) {
      throw new Error("Every reading must be an object");
    }

    const fields = Object.keys(reading).sort();
    // Reject missing fields and extra fields.
    if (
      fields.length !== sortedRequiredFields.length ||
      fields.some((field, index) => field !== sortedRequiredFields[index])
    ) {
      throw new Error("Every reading must contain exactly the required fields");
    }

    if (!allowedCrops.includes(reading.crop_name)) {
      throw new Error("A reading contains an invalid crop name");
    }

    if (
      typeof reading.timestamp !== "string" ||
      !isValidTimestamp(reading.timestamp)
    ) {
      throw new Error("A reading contains an invalid timestamp");
    }

    const cropTimestamps = timestampsByCrop.get(reading.crop_name);
    // A crop cannot have two readings with the same timestamp.
    if (cropTimestamps.has(reading.timestamp)) {
      throw new Error("Timestamps must be unique within each crop");
    }
    cropTimestamps.add(reading.timestamp);

    for (const field of ["soil_moisture", "temperature", "rainfall"]) {
      // Values must be numbers, but business ranges are checked by the frontend.
      if (typeof reading[field] !== "number" || !Number.isFinite(reading[field])) {
        throw new Error(`${field} must be a finite number`);
      }
    }

    if (!allowedStatuses.has(reading.sensor_status)) {
      throw new Error("A reading contains an invalid sensor status");
    }

    if (typeof reading.notes !== "string") {
      throw new Error("Reading notes must be a string");
    }

    cropCounts.set(reading.crop_name, cropCounts.get(reading.crop_name) + 1);
  }

  if (allowedCrops.some((crop) => cropCounts.get(crop) !== 5)) {
    throw new Error("Expected exactly five readings for each crop");
  }

  return readings;
}

export async function readSensorReadings(
  filePath = process.env.SENSOR_READINGS_PATH || sensorReadingsPath,
) {
  // Read, parse and validate the file every time this function is called.
  const contents = await readFile(filePath, "utf8");
  return validateSensorReadings(JSON.parse(contents));
}
