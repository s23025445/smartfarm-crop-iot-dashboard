import assert from "node:assert/strict";
import test from "node:test";
import {
  analyseCrop,
  calculateFarmStatus,
  getAvailableCropNames,
  getLatestReading,
} from "../src/utils/analysis.js";

const crop = {
  id: 1,
  crop_name: "Tomato",
  location: "Greenhouse A",
  target_min: 55,
  target_max: 75,
  normal_water: 500,
  notes: "",
};

function reading(changes = {}) {
  return {
    crop_name: "Tomato",
    timestamp: "2026-08-05T09:00:00",
    soil_moisture: 65,
    temperature: 25,
    rainfall: 0,
    sensor_status: "Online",
    notes: "",
    ...changes,
  };
}

test("available crop names exclude existing Crop Cards", () => {
  const readings = [reading(), reading({ crop_name: "Maize" })];
  assert.deepEqual(getAvailableCropNames(readings, [crop]), ["Maize"]);
});

test("latest reading uses the greatest timestamp", () => {
  const readings = [
    reading({ timestamp: "2026-08-05T09:00:00" }),
    reading({ timestamp: "2026-08-01T09:00:00" }),
    reading({ timestamp: "2026-08-06T09:00:00" }),
  ];
  assert.equal(
    getLatestReading("Tomato", readings).timestamp,
    "2026-08-06T09:00:00",
  );
});

test("crop name matching is exact and case-sensitive", () => {
  const readings = [reading()];

  assert.equal(getLatestReading("Tomato", readings), readings[0]);
  assert.equal(getLatestReading("tomato", readings), null);
});

test("moisture boundaries are Healthy", () => {
  assert.equal(analyseCrop(crop, reading({ soil_moisture: 55 })).condition, "Healthy");
  assert.equal(analyseCrop(crop, reading({ soil_moisture: 75 })).condition, "Healthy");
});

test("sensor problems take priority over invalid numeric values", () => {
  const result = analyseCrop(
    crop,
    reading({ sensor_status: "Faulty", soil_moisture: 120 }),
  );
  assert.equal(result.condition, "Sensor Problem");
  assert.equal(result.recommended_water, "N/A");
});

test("temperature and rainfall boundaries follow the decision table", () => {
  const noAlerts = analyseCrop(crop, reading({ temperature: 35, rainfall: 4.9 }));
  assert.deepEqual(noAlerts.alerts, []);

  const rainAlert = analyseCrop(crop, reading({ temperature: 35.1, rainfall: 5 }));
  assert.deepEqual(rainAlert.alerts, ["High temperature", "Rain detected"]);
});

test("farm status follows No Crops, Critical, Watch and Normal priority", () => {
  assert.equal(calculateFarmStatus([]), "No Crops");

  const healthy = analyseCrop(crop, reading());
  const dry = analyseCrop(crop, reading({ soil_moisture: 40 }));
  const faulty = analyseCrop(crop, reading({ sensor_status: "Faulty" }));

  assert.equal(calculateFarmStatus([healthy]), "Normal");
  assert.equal(calculateFarmStatus([healthy, dry]), "Watch");
  assert.equal(calculateFarmStatus([healthy, dry, faulty]), "Critical");
});
