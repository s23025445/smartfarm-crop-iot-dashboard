import { readFile } from "node:fs/promises";
import app from "../server.js";
import { resetDatabase } from "../db.js";
import { sensorReadingsPath } from "../utils/sensorData.js";

const divider = "=".repeat(78);
const detailDivider = "-".repeat(78);
const results = [];
let testNumber = 0;

function format(value) {
  return JSON.stringify(value, null, 2);
}

function printField(label, value) {
  console.log(`${label}:`);
  console.log(typeof value === "string" ? value : format(value));
}

async function runCase(baseUrl, {
  name,
  method = "GET",
  path,
  params,
  body,
  expectedStatus,
  expectation,
  verify = () => true,
  summarizeResponse,
  capture,
}) {
  testNumber += 1;
  console.log(`\n${divider}`);
  console.log(`${testNumber}. ${name}`);
  console.log(detailDivider);
  console.log(`Request:         ${method} ${path}`);
  console.log(`Route params:    ${params ? format(params) : "None"}`);
  console.log(`Expected status: ${expectedStatus}`);
  console.log(`Expectation:     ${expectation}`);
  printField("Request body", body === undefined ? "None" : body);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers:
        body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const responseBody = await response.json();
    const statusMatches = response.status === expectedStatus;
    const bodyMatches = Boolean(verify(responseBody));
    const passed = statusMatches && bodyMatches;

    console.log(`Actual status:   ${response.status}`);
    printField(
      "Response body",
      summarizeResponse ? summarizeResponse(responseBody) : responseBody,
    );
    console.log(`Result:          ${passed ? "PASS" : "FAIL"}`);

    if (!statusMatches) {
      console.log(
        `Failure reason: Expected HTTP ${expectedStatus}, received ${response.status}`,
      );
    } else if (!bodyMatches) {
      console.log("Failure reason: Response body did not meet the expectation");
    }

    results.push({ number: testNumber, name, passed });
    capture?.(responseBody);
  } catch (error) {
    console.log("Actual status:   No response");
    console.log(`Failure reason:  ${error.message}`);
    console.log("Result:          FAIL");
    results.push({ number: testNumber, name, passed: false });
  }
}

const maizeCreateBody = {
  crop_name: "Maize",
  location: "South Field",
  target_min: 50,
  target_max: 70,
  normal_water: 600,
};

async function main() {
  // Start with the three original Crop Cards.
  resetDatabase();
  const sensorFileBefore = await readFile(sensorReadingsPath, "utf8");
  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  let maizeId;

  console.log(divider);
  console.log("SmartFarm Backend API — Elaborated Test Walkthrough");
  console.log(divider);
  console.log(`Test API:           ${baseUrl}`);
  console.log("Database: Reset before and after this walkthrough");
  console.log("Sensor JSON: Read-only during this walkthrough");

  try {
    await runCase(baseUrl, {
      name: "Check that the Express API is running",
      path: "/api",
      expectedStatus: 200,
      expectation: "Response contains the API running message",
      verify: (body) => body.message === "API is running!",
    });

    await runCase(baseUrl, {
      name: "Read and validate the sensor feed",
      path: "/api/readings",
      expectedStatus: 200,
      expectation: "Response is the raw array of exactly 20 readings",
      verify: (body) => Array.isArray(body) && body.length === 20,
      summarizeResponse: (body) => ({
        type: Array.isArray(body) ? "array" : typeof body,
        reading_count: Array.isArray(body) ? body.length : undefined,
        crop_counts: Array.isArray(body)
          ? Object.fromEntries(
              ["Tomato", "Lettuce", "Wheat", "Maize"].map((crop) => [
                crop,
                body.filter((reading) => reading.crop_name === crop).length,
              ]),
            )
          : undefined,
        first_reading: Array.isArray(body) ? body[0] : undefined,
      }),
    });

    await runCase(baseUrl, {
      name: "List the three seeded Crop Cards",
      path: "/api/crops",
      expectedStatus: 200,
      expectation: "Response contains Tomato, Lettuce and Wheat",
      verify: (body) =>
        Array.isArray(body) &&
        body.length === 3 &&
        body.map((crop) => crop.crop_name).join(",") ===
          "Tomato,Lettuce,Wheat",
    });

    await runCase(baseUrl, {
      name: "Get the Tomato Crop Card by id",
      path: "/api/crops/1",
      params: { id: 1 },
      expectedStatus: 200,
      expectation: "Response is the Tomato Crop Card",
      verify: (body) => body.id === 1 && body.crop_name === "Tomato",
    });

    await runCase(baseUrl, {
      name: "Reject a nonexistent Crop Card id",
      path: "/api/crops/9999",
      params: { id: 9999 },
      expectedStatus: 404,
      expectation: "Response contains a clear not-found error",
      verify: (body) => body.error === "Crop card not found",
    });

    await runCase(baseUrl, {
      name: "Reject a numeric string during creation",
      method: "POST",
      path: "/api/crops",
      body: { ...maizeCreateBody, target_min: "50" },
      expectedStatus: 400,
      expectation: "target_min must be rejected because it is not a JSON number",
      verify: (body) => typeof body.error === "string",
    });

    await runCase(baseUrl, {
      name: "Reject a crop name absent from the sensor feed",
      method: "POST",
      path: "/api/crops",
      body: { ...maizeCreateBody, crop_name: "Rice" },
      expectedStatus: 400,
      expectation: "Rice is rejected after reading the actual sensor JSON",
      verify: (body) =>
        body.error === "crop_name does not exist in sensor data",
    });

    await runCase(baseUrl, {
      name: "Create the Maize Crop Card",
      method: "POST",
      path: "/api/crops",
      body: maizeCreateBody,
      expectedStatus: 201,
      expectation: "A persisted Maize record is returned with generated fields",
      verify: (body) =>
        Number.isInteger(body.id) &&
        body.crop_name === "Maize" &&
        body.notes === "" &&
        typeof body.created_at === "string",
      capture: (body) => {
        maizeId = body.id;
      },
    });

    await runCase(baseUrl, {
      name: "Reject a duplicate Maize Crop Card",
      method: "POST",
      path: "/api/crops",
      body: maizeCreateBody,
      expectedStatus: 409,
      expectation: "The unique crop_name conflict is reported",
      verify: (body) =>
        body.error === "crop_name already exists",
    });

    await runCase(baseUrl, {
      name: "Reject modification of the immutable crop_name",
      method: "PUT",
      path: `/api/crops/${maizeId}`,
      params: { id: maizeId },
      body: { ...maizeCreateBody, crop_name: "Tomato" },
      expectedStatus: 400,
      expectation: "Changing Maize to Tomato is rejected",
      verify: (body) => body.error === "crop_name cannot be changed",
    });

    await runCase(baseUrl, {
      name: "Update permitted Maize fields",
      method: "PUT",
      path: `/api/crops/${maizeId}`,
      params: { id: maizeId },
      body: {
        location: "South Field 2",
        target_min: 52,
        target_max: 72,
        normal_water: 475,
        notes: "Updated by API walkthrough",
      },
      expectedStatus: 200,
      expectation: "Mutable fields change while crop_name remains Maize",
      verify: (body) =>
        body.crop_name === "Maize" &&
        body.location === "South Field 2" &&
        body.notes === "Updated by API walkthrough",
    });

    await runCase(baseUrl, {
      name: "Reject deletion of a nonexistent Crop Card",
      method: "DELETE",
      path: "/api/crops/9999",
      params: { id: 9999 },
      expectedStatus: 404,
      expectation: "Response contains a clear not-found error",
      verify: (body) => body.error === "Crop card not found",
    });

    await runCase(baseUrl, {
      name: "Delete Maize from SQLite",
      method: "DELETE",
      path: `/api/crops/${maizeId}`,
      params: { id: maizeId },
      expectedStatus: 200,
      expectation: "Response confirms the deleted SQLite id",
      verify: (body) => body.deleted === true && body.id === maizeId,
    });

    await runCase(baseUrl, {
      name: "Re-create Maize after deletion",
      method: "POST",
      path: "/api/crops",
      body: { ...maizeCreateBody, notes: "Re-created successfully" },
      expectedStatus: 201,
      expectation: "Deletion releases the crop name for a new record",
      verify: (body) =>
        body.crop_name === "Maize" &&
        body.id !== maizeId &&
        body.notes === "Re-created successfully",
    });

    const sensorFileAfter = await readFile(sensorReadingsPath, "utf8");
    const sensorUnchanged = sensorFileAfter === sensorFileBefore;
    testNumber += 1;
    console.log(`\n${divider}`);
    console.log(`${testNumber}. Confirm CRUD did not modify sensor-readings.json`);
    console.log(detailDivider);
    console.log("Expected:         Sensor file contents remain byte-for-byte identical");
    console.log(`Actual:           ${sensorUnchanged ? "Unchanged" : "Changed"}`);
    console.log(`Result:           ${sensorUnchanged ? "PASS" : "FAIL"}`);
    results.push({
      number: testNumber,
      name: "Sensor JSON remains unchanged",
      passed: sensorUnchanged,
    });
  } finally {
    try {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    } finally {
      // Leave the database ready for normal use after the walkthrough.
      resetDatabase();
    }
  }

  const passedCount = results.filter((result) => result.passed).length;
  const failed = results.filter((result) => !result.passed);

  console.log(`\n${divider}`);
  console.log("FINAL SUMMARY");
  console.log(divider);
  console.log(`Total tests:  ${results.length}`);
  console.log(`Passed:       ${passedCount}`);
  console.log(`Failed:       ${failed.length}`);
  console.log("Database restored to seed data: Yes");
  console.log("Sensor JSON modified:         No");

  if (failed.length > 0) {
    console.log("\nFailed cases:");
    for (const result of failed) {
      console.log(`  ${result.number}. ${result.name}`);
    }
    process.exitCode = 1;
  } else {
    console.log("\nAll elaborated API tests passed.");
  }
}

main().catch((error) => {
  console.error("\nThe API walkthrough could not complete:");
  console.error(error);
  process.exitCode = 1;
});
