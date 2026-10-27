import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import app from "../server.js";
import {
  allowedCrops,
  readSensorReadings,
  requiredReadingFields,
  sensorReadingsPath,
  validateSensorReadings,
} from "../utils/sensorData.js";

const targetRanges = {
  Tomato: [55, 75],
  Lettuce: [60, 80],
  Wheat: [35, 55],
  Maize: [50, 70],
};

let temporaryDirectory;

before(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "smartfarm-sensors-"));
});

after(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

test("sensor file has the required structure and distribution", async () => {
  const readings = await readSensorReadings();

  assert.equal(readings.length, 20);

  for (const crop of allowedCrops) {
    assert.equal(
      readings.filter((reading) => reading.crop_name === crop).length,
      5,
    );
  }

  for (const reading of readings) {
    assert.deepEqual(Object.keys(reading).sort(), [...requiredReadingFields].sort());
    assert.equal(typeof reading.crop_name, "string");
    assert.equal(typeof reading.timestamp, "string");
    assert.equal(typeof reading.soil_moisture, "number");
    assert.equal(typeof reading.temperature, "number");
    assert.equal(typeof reading.rainfall, "number");
    assert.equal(typeof reading.sensor_status, "string");
    assert.equal(typeof reading.notes, "string");
  }

  const times = readings.map((reading) => reading.timestamp);
  const ascending = [...times].sort();
  const descending = [...ascending].reverse();
  assert.notDeepEqual(times, ascending);
  assert.notDeepEqual(times, descending);
});

test("latest readings produce all required cases", async () => {
  const readings = await readSensorReadings();
  const latest = Object.fromEntries(
    allowedCrops.map((crop) => [
      crop,
      readings
        .filter((reading) => reading.crop_name === crop)
        .sort((left, right) => right.timestamp.localeCompare(left.timestamp))[0],
    ]),
  );

  assert.equal(latest.Tomato.sensor_status, "Online");
  assert.ok(latest.Tomato.soil_moisture < targetRanges.Tomato[0]);
  assert.ok(latest.Tomato.temperature > 35);

  assert.equal(latest.Lettuce.sensor_status, "Online");
  assert.ok(latest.Lettuce.soil_moisture >= targetRanges.Lettuce[0]);
  assert.ok(latest.Lettuce.soil_moisture <= targetRanges.Lettuce[1]);

  assert.equal(latest.Wheat.sensor_status, "Online");
  assert.ok(latest.Wheat.soil_moisture > targetRanges.Wheat[1]);
  assert.ok(latest.Wheat.rainfall >= 5);

  assert.equal(latest.Maize.sensor_status, "Faulty");
});

test("there is exactly one intentional out-of-range numeric value", async () => {
  const readings = await readSensorReadings();
  const violations = [];

  for (const reading of readings) {
    for (const [field, minimum, maximum] of [
      ["soil_moisture", 0, 100],
      ["temperature", 0, 50],
      ["rainfall", 0, 50],
    ]) {
      if (reading[field] < minimum || reading[field] > maximum) {
        violations.push({ reading, field });
      }
    }
  }

  assert.equal(violations.length, 1);
  assert.equal(violations[0].reading.crop_name, "Wheat");
  assert.equal(violations[0].field, "soil_moisture");
  assert.equal(violations[0].reading.soil_moisture, 120);

  const latestWheatTimestamp = readings
    .filter((reading) => reading.crop_name === "Wheat")
    .map((reading) => reading.timestamp)
    .sort()
    .at(-1);
  assert.notEqual(violations[0].reading.timestamp, latestWheatTimestamp);
});

test("validator rejects impossible dates and duplicate per-crop timestamps", async () => {
  const readings = await readSensorReadings();
  const impossibleDate = structuredClone(readings);
  impossibleDate[0].timestamp = "2026-02-30T08:20:00";
  assert.throws(() => validateSensorReadings(impossibleDate));

  const duplicateTimestamp = structuredClone(readings);
  const tomatoIndexes = duplicateTimestamp
    .map((reading, index) => ({ reading, index }))
    .filter(({ reading }) => reading.crop_name === "Tomato")
    .map(({ index }) => index);
  duplicateTimestamp[tomatoIndexes[1]].timestamp =
    duplicateTimestamp[tomatoIndexes[0]].timestamp;
  assert.throws(() => validateSensorReadings(duplicateTimestamp));
});

test("GET /api/readings returns the raw validated array", async () => {
  const server = app.listen(0);

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/readings`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.length, 20);
    assert.deepEqual(body, await readSensorReadings(sensorReadingsPath));
    assert.ok(body.every((reading) => Object.keys(reading).length === 7));
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("GET /api/readings rereads the file and rejects structural errors", async () => {
  const changingPath = join(temporaryDirectory, "changing-readings.json");
  await writeFile(
    changingPath,
    JSON.stringify(await readSensorReadings()),
    "utf8",
  );

  process.env.SENSOR_READINGS_PATH = changingPath;
  const server = app.listen(0);

  try {
    const address = server.address();
    const url = `http://127.0.0.1:${address.port}/api/readings`;
    const firstResponse = await fetch(url);

    assert.equal(firstResponse.status, 200);

    await writeFile(changingPath, "[]", "utf8");
    const secondResponse = await fetch(url);

    assert.equal(secondResponse.status, 500);
    assert.deepEqual(await secondResponse.json(), {
      error: "Sensor data file is invalid",
    });
  } finally {
    delete process.env.SENSOR_READINGS_PATH;
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
