import { closeDatabase, listCrops, resetDatabase } from "../db.js";

// Remove all Crop Cards and add the three starting cards again.
resetDatabase();

console.log("Database reset complete.");
console.log("Seeded Crop Cards:");

for (const crop of listCrops()) {
  console.log(`- ${crop.crop_name} (${crop.location})`);
}

closeDatabase();
