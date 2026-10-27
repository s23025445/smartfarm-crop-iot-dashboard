import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import app from "../server.js";
import { resetDatabase } from "../db.js";
import { validateCropPayload } from "../utils/cropValidation.js";
import { sensorReadingsPath } from "../utils/sensorData.js";

let server;
let baseUrl;

before(() => {
  // Start every test run with the original three Crop Cards.
  resetDatabase();
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }

  // Put the real database back to its starting state after the tests.
  resetDatabase();
});

async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return { response, body: await response.json() };
}

const maizePayload = {
  crop_name: "Maize",
  location: "South Field",
  target_min: 50,
  target_max: 70,
  normal_water: 450,
};

test("Crop Card CRUD API", async (t) => {
  const sensorFileBefore = await readFile(sensorReadingsPath, "utf8");
  let maizeId;

  await t.test("lists seeded Crop Cards", async () => {
    const result = await request("/api/crops");
    assert.equal(result.response.status, 200);
    assert.equal(result.body.length, 3);
    assert.deepEqual(
      result.body.map((crop) => crop.crop_name),
      ["Tomato", "Lettuce", "Wheat"],
    );
  });

  await t.test("gets one Crop Card and returns 404 when absent", async () => {
    const found = await request("/api/crops/1");
    assert.equal(found.response.status, 200);
    assert.equal(found.body.crop_name, "Tomato");

    const missing = await request("/api/crops/9999");
    assert.equal(missing.response.status, 404);
    assert.deepEqual(missing.body, { error: "Crop card not found" });
  });

  await t.test("returns JSON for an unknown API route", async () => {
    const result = await request("/api/not-a-real-route");
    assert.equal(result.response.status, 404);
    assert.deepEqual(result.body, { error: "API route not found" });
  });

  await t.test("rejects invalid ids and request fields", async () => {
    const invalidId = await request("/api/crops/not-a-number");
    assert.equal(invalidId.response.status, 400);
    assert.equal(typeof invalidId.body.error, "string");

    const missingField = await request("/api/crops", {
      method: "POST",
      body: { crop_name: "Maize" },
    });
    assert.equal(missingField.response.status, 400);

    const numericString = await request("/api/crops", {
      method: "POST",
      body: { ...maizePayload, target_min: "50" },
    });
    assert.equal(numericString.response.status, 400);

    const invalidRange = await request("/api/crops", {
      method: "POST",
      body: { ...maizePayload, target_min: 70, target_max: 70 },
    });
    assert.equal(invalidRange.response.status, 400);

    const extraField = await request("/api/crops", {
      method: "POST",
      body: { ...maizePayload, id: 50 },
    });
    assert.equal(extraField.response.status, 400);

    const nullNotes = await request("/api/crops", {
      method: "POST",
      body: { ...maizePayload, notes: null },
    });
    assert.equal(nullNotes.response.status, 400);
  });

  await t.test("rejects names that are absent from the actual sensor feed", async () => {
    const result = await request("/api/crops", {
      method: "POST",
      body: { ...maizePayload, crop_name: "Rice" },
    });
    assert.equal(result.response.status, 400);
    assert.equal(
      result.body.error,
      "crop_name does not exist in sensor data",
    );
  });

  await t.test("creates Maize and applies the notes default", async () => {
    const result = await request("/api/crops", {
      method: "POST",
      body: maizePayload,
    });
    assert.equal(result.response.status, 201);
    assert.equal(result.body.crop_name, "Maize");
    assert.equal(result.body.notes, "");
    assert.equal(typeof result.body.id, "number");
    assert.equal(typeof result.body.created_at, "string");
    maizeId = result.body.id;
  });

  await t.test("rejects a duplicate crop name", async () => {
    const result = await request("/api/crops", {
      method: "POST",
      body: maizePayload,
    });
    assert.equal(result.response.status, 409);
    assert.equal(
      result.body.error,
      "crop_name already exists",
    );
  });

  await t.test("rejects crop_name modification and invalid updates", async () => {
    const changedName = await request(`/api/crops/${maizeId}`, {
      method: "PUT",
      body: { ...maizePayload, crop_name: "Tomato" },
    });
    assert.equal(changedName.response.status, 400);
    assert.equal(changedName.body.error, "crop_name cannot be changed");

    const invalidWater = await request(`/api/crops/${maizeId}`, {
      method: "PUT",
      body: { ...maizePayload, normal_water: 0 },
    });
    assert.equal(invalidWater.response.status, 400);

    const missing = await request("/api/crops/9999", {
      method: "PUT",
      body: maizePayload,
    });
    assert.equal(missing.response.status, 404);
  });

  await t.test("updates mutable fields with crop_name omitted", async () => {
    const result = await request(`/api/crops/${maizeId}`, {
      method: "PUT",
      body: {
        location: "South Field 2",
        target_min: 52,
        target_max: 72,
        normal_water: 475,
        notes: "Updated card",
      },
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.crop_name, "Maize");
    assert.equal(result.body.location, "South Field 2");
    assert.equal(result.body.notes, "Updated card");
  });

  await t.test("deletes only SQLite data and returns 404 afterward", async () => {
    const missing = await request("/api/crops/9999", { method: "DELETE" });
    assert.equal(missing.response.status, 404);

    const deleted = await request(`/api/crops/${maizeId}`, { method: "DELETE" });
    assert.equal(deleted.response.status, 200);
    assert.deepEqual(deleted.body, { deleted: true, id: maizeId });

    const lookup = await request(`/api/crops/${maizeId}`);
    assert.equal(lookup.response.status, 404);
  });

  await t.test("re-creates a Crop Card after deletion", async () => {
    const result = await request("/api/crops", {
      method: "POST",
      body: { ...maizePayload, notes: "Re-created" },
    });
    assert.equal(result.response.status, 201);
    assert.equal(result.body.crop_name, "Maize");
    assert.notEqual(result.body.id, maizeId);
  });

  await t.test("rejects non-finite numbers in reusable validation", () => {
    assert.equal(
      validateCropPayload({ ...maizePayload, target_min: Number.NaN }).error,
      "target_min must be a finite JSON number",
    );
    assert.equal(
      validateCropPayload({
        ...maizePayload,
        normal_water: Number.POSITIVE_INFINITY,
      }).error,
      "normal_water must be a finite JSON number",
    );
  });

  const sensorFileAfter = await readFile(sensorReadingsPath, "utf8");
  assert.equal(sensorFileAfter, sensorFileBefore);
});
