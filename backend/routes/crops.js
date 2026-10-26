import { Router } from "express";
import {
  createCrop,
  deleteCrop,
  findCropById,
  findCropByName,
  listCrops,
  updateCrop,
} from "../db.js";
import { validateCropPayload } from "../utils/cropValidation.js";
import { readSensorReadings } from "../utils/sensorData.js";

const router = Router();

// Add an HTTP status to a normal Error so server.js knows how to respond.
function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isDuplicateCropNameError(error) {
  // SQLite can still catch a duplicate if two requests happen at the same time.
  return (
    error instanceof Error &&
    error.message.includes("UNIQUE constraint failed: crops.crop_name")
  );
}

// GET /api/crops - return every Crop Card.
router.get("/", (req, res) => {
  res.status(200).json(listCrops());
});

// GET /api/crops/:id - return one Crop Card.
router.get("/:id", (req, res) => {
  // Route parameters are strings, so check the id before converting it.
  if (!/^[1-9]\d*$/.test(req.params.id)) {
    throw httpError(400, "Crop Card id must be a positive integer");
  }

  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id)) {
    throw httpError(400, "Crop Card id must be a positive integer");
  }

  const crop = findCropById(id);

  if (!crop) {
    throw httpError(404, "Crop card not found");
  }

  res.status(200).json(crop);
});

// POST /api/crops - validate and create a new Crop Card.
router.post("/", async (req, res) => {
  const validation = validateCropPayload(req.body);
  if (validation.error) {
    throw httpError(400, validation.error);
  }

  const crop = validation.data;
  let readings;

  try {
    // Read the real sensor file so crop names are not hard-coded here.
    readings = await readSensorReadings();
  } catch {
    throw httpError(500, "Sensor data file is invalid");
  }

  const validCropNames = new Set(
    readings.map((reading) => reading.crop_name),
  );
  if (!validCropNames.has(crop.crop_name)) {
    throw httpError(400, "crop_name does not exist in sensor data");
  }

  if (findCropByName(crop.crop_name)) {
    throw httpError(409, "crop_name already exists");
  }

  try {
    res.status(201).json(createCrop(crop));
  } catch (error) {
    if (isDuplicateCropNameError(error)) {
      throw httpError(409, "crop_name already exists");
    }
    throw error;
  }
});

// PUT /api/crops/:id - update a card but keep its crop name unchanged.
router.put("/:id", (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.id)) {
    throw httpError(400, "Crop Card id must be a positive integer");
  }

  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id)) {
    throw httpError(400, "Crop Card id must be a positive integer");
  }

  const existingCrop = findCropById(id);

  if (!existingCrop) {
    throw httpError(404, "Crop card not found");
  }

  const validation = validateCropPayload(req.body, false);
  if (validation.error) {
    throw httpError(400, validation.error);
  }

  const updates = validation.data;
  if (
    Object.hasOwn(updates, "crop_name") &&
    updates.crop_name !== existingCrop.crop_name
  ) {
    throw httpError(400, "crop_name cannot be changed");
  }

  const updatedCrop = updateCrop(id, {
    ...updates,
    crop_name: existingCrop.crop_name,
  });
  res.status(200).json(updatedCrop);
});

// DELETE /api/crops/:id - only remove the row from SQLite.
router.delete("/:id", (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.id)) {
    throw httpError(400, "Crop Card id must be a positive integer");
  }

  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id)) {
    throw httpError(400, "Crop Card id must be a positive integer");
  }

  if (!deleteCrop(id)) {
    throw httpError(404, "Crop card not found");
  }

  res.status(200).json({ deleted: true, id });
});

export default router;
