import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

// Build the database path from this file, so it works from any terminal folder.
const backendDirectory = dirname(fileURLToPath(import.meta.url));
const dataDirectory = join(backendDirectory, "data");

mkdirSync(dataDirectory, { recursive: true });

export const databasePath = join(dataDirectory, "smartfarm.sqlite");

// SQL used to create the Crop Card table if it does not exist yet.
const createCropsTableSql = `
  CREATE TABLE IF NOT EXISTS crops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crop_name TEXT NOT NULL UNIQUE
      CHECK (crop_name IN ('Tomato','Lettuce','Wheat','Maize')),
    location TEXT NOT NULL,
    target_min REAL NOT NULL CHECK (target_min >= 0 AND target_min <= 100),
    target_max REAL NOT NULL CHECK (target_max >= 0 AND target_max <= 100),
    normal_water REAL NOT NULL CHECK (normal_water > 0 AND normal_water <= 10000),
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (target_min < target_max)
  );
`;

// These cards are only added when the table is empty.
const initialCrops = [
  ["Tomato", "Greenhouse A", 55, 75, 500, ""],
  ["Lettuce", "Greenhouse B", 60, 80, 400, ""],
  ["Wheat", "North Field", 35, 55, 300, ""],
];

// Open the database and create the table when this file is loaded.
const database = new DatabaseSync(databasePath);
database.prepare(createCropsTableSql).run();

// Prepare the SQL once and reuse it whenever a database function is called.
// The question marks keep values separate from the SQL statement.
const countCrops = database.prepare("SELECT COUNT(*) AS count FROM crops");
const seedCrop = database.prepare(`
  INSERT INTO crops (
    crop_name, location, target_min, target_max, normal_water, notes
  ) VALUES (?, ?, ?, ?, ?, ?)
`);
const listCropsStatement = database.prepare(`
  SELECT id, crop_name, location, target_min, target_max, normal_water, notes, created_at
  FROM crops
  ORDER BY id
`);
const findCropByIdStatement = database.prepare(`
  SELECT id, crop_name, location, target_min, target_max, normal_water, notes, created_at
  FROM crops
  WHERE id = ?
`);
const findCropByNameStatement = database.prepare(`
  SELECT id, crop_name, location, target_min, target_max, normal_water, notes, created_at
  FROM crops
  WHERE crop_name = ?
`);
const createCropStatement = database.prepare(`
  INSERT INTO crops (
    crop_name, location, target_min, target_max, normal_water, notes
  ) VALUES (?, ?, ?, ?, ?, ?)
`);
const updateCropStatement = database.prepare(`
  UPDATE crops
  SET crop_name = ?,
      location = ?,
      target_min = ?,
      target_max = ?,
      normal_water = ?,
      notes = ?
  WHERE id = ?
`);
const deleteCropStatement = database.prepare("DELETE FROM crops WHERE id = ?");
const deleteAllCropsStatement = database.prepare("DELETE FROM crops");
const resetCropIdsStatement = database.prepare(
  "DELETE FROM sqlite_sequence WHERE name = ?",
);

export function initializeDatabase() {
  // Do not seed again when Crop Cards already exist.
  if (countCrops.get().count !== 0) {
    return;
  }

  // A transaction makes sure either all seed cards are added or none are.
  database.exec("BEGIN IMMEDIATE");
  try {
    if (countCrops.get().count === 0) {
      for (const crop of initialCrops) {
        seedCrop.run(...crop);
      }
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function listCrops() {
  return listCropsStatement.all();
}

export function findCropById(id) {
  return findCropByIdStatement.get(id);
}

export function findCropByName(cropName) {
  return findCropByNameStatement.get(cropName);
}

export function createCrop({
  crop_name,
  location,
  target_min,
  target_max,
  normal_water,
  notes = "",
}) {
  const result = createCropStatement.run(
    crop_name,
    location,
    target_min,
    target_max,
    normal_water,
    notes,
  );
  // Return the complete row, including its generated id and date.
  return findCropById(result.lastInsertRowid);
}

export function updateCrop(
  id,
  { crop_name, location, target_min, target_max, normal_water, notes = "" },
) {
  const result = updateCropStatement.run(
    crop_name,
    location,
    target_min,
    target_max,
    normal_water,
    notes,
    id,
  );
  return result.changes === 0 ? undefined : findCropById(id);
}

export function deleteCrop(id) {
  return deleteCropStatement.run(id).changes > 0;
}

export function resetDatabase() {
  // Clear the table and add the three original Crop Cards again.
  database.exec("BEGIN IMMEDIATE");
  try {
    deleteAllCropsStatement.run();
    resetCropIdsStatement.run("crops");
    for (const crop of initialCrops) {
      seedCrop.run(...crop);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function closeDatabase() {
  database.close();
}
