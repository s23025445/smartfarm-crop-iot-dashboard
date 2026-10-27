# SmartFarm Crop IoT Dashboard

This project is a full-stack university assignment using React, Express and SQLite. It includes a classic-styled dashboard for managing Crop Cards and viewing simulated IoT sensor data.

## Project URLs

- Frontend development URL: `http://localhost:5173`
- Backend development URL: `http://localhost:3000`

## Requirements

- Node.js 22.5 or newer because the backend uses the built-in `node:sqlite` module
- npm

## Run the backend

Open a terminal in the `backend` folder and run:

```bash
npm install
npm run seed
npm run dev
```

The API will be available at `http://localhost:3000`.

For a normal start without watch mode, use:

```bash
npm start
```

## Run the frontend

Open another terminal in the `frontend` folder and run:

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Keep the backend running at `http://localhost:3000` while using the dashboard.

The frontend lets the user:

- view each Crop Card with its latest sensor reading
- see calculated conditions, watering recommendations and alerts
- create the initially missing Maize card
- edit Crop Card settings without changing the crop name
- delete Crop Cards without deleting sensor readings
- view all sensor readings for a crop in newest-first order
- refresh the sensor data from the backend

## Database creation and seeding

Crop Cards are stored in `backend/data/smartfarm.sqlite`. When the backend starts, `db.js` creates the `crops` table if it does not exist. Tomato, Lettuce and Wheat are inserted only when the table is empty. Maize is not seeded because it must be created through the application.

To delete the current Crop Cards and restore the three starting cards, run:

```bash
npm run seed
```

This reset command is intended for development and testing. It deletes existing Crop Card changes.

## Testing and acceptance checks

The assignment asks students to confirm the acceptance-test table before submission. It does not require every acceptance test to be automated. This project includes small automated tests as extra evidence, while complete browser behaviour is also checked manually and demonstrated in the video.

### Backend automated tests

From the `backend` folder, run:

```bash
npm test
```

The backend suite checks Crop Card CRUD, request validation, duplicate and immutable crop names, sensor-file validation, crop counts, timestamps, the intentional invalid reading and JSON error responses. The Crop Card tests reset the real development database before and after testing.

To see numbered requests, request bodies, status codes and response bodies, run:

```bash
npm run test:api-demo
```

The API demo is a student-friendly test script that prints each numbered request, request body, status code and response body.

### Frontend automated tests

From the `frontend` folder, run:

```bash
npm test
```

These tests use Node's built-in test runner. They check available dropdown names, exact case-sensitive matching, greatest-timestamp selection, moisture boundaries, Sensor Problem priority, temperature and rainfall boundaries, and Overall Farm Status. A larger React testing library is not required for this assignment.

### Frontend quality checks

From the `frontend` folder, run:

```bash
npm run lint
npm run build
```

## API routes

| Method | Route            | Purpose                                         |
| ------ | ---------------- | ----------------------------------------------- |
| GET    | `/api`           | Check that the backend is running               |
| GET    | `/api/crops`     | Return all Crop Cards                           |
| GET    | `/api/crops/:id` | Return one Crop Card                            |
| POST   | `/api/crops`     | Create a Crop Card                              |
| PUT    | `/api/crops/:id` | Update a Crop Card without changing `crop_name` |
| DELETE | `/api/crops/:id` | Delete one Crop Card from SQLite                |
| GET    | `/api/readings`  | Read, validate and return the raw sensor JSON   |

All failed API responses use this format:

```json
{
  "error": "Clear message describing the problem"
}
```

## Data ownership

The application has two separate data sources:

- Crop Cards are stored in SQLite and may be created, read, updated and deleted by the user.
- Sensor readings are stored in `backend/data/sensor-readings.json` and are read-only inside the application.

The backend never stores calculated conditions, recommendations, alerts, the latest reading, the last refresh time or Overall Farm Status in SQLite. Those values belong in React state.

## Crop matching and latest readings

`crop_name` is the exact, case-sensitive key used to join a Crop Card with its sensor readings. For example, `Tomato` matches `Tomato`, but it does not match `tomato`.

The frontend must filter readings by `crop_name` and select the greatest timestamp. It must not assume that the last reading in the JSON array is the newest.

Exact matching was verified with a frontend test showing that `Tomato` matches while `tomato` returns no reading. Crop-name uniqueness was verified through backend tests that reject a duplicate with HTTP 409 and reject names that do not exist in the validated sensor file. The latest-timestamp tests use deliberately mixed reading order, and the sensor tests verify all four required latest cases.

## Dashboard decision priority

The frontend must analyse the latest matching reading in this order:

1. Offline or Faulty becomes **Sensor Problem**.
2. An Online reading with an out-of-range numeric value becomes **Invalid Data**.
3. Moisture below `target_min` becomes **Dry**.
4. Moisture between the target values, including the boundaries, becomes **Healthy**.
5. Moisture above `target_max` becomes **Too Wet**.

High temperature and rain are additional alerts for valid Online readings. They do not replace the main condition.

## Sensor JSON generation prompt

The first sensor file was generated with OpenAI Codex using this prompt:

> Generate exactly 20 sensor-reading objects: five Tomato, five Lettuce, five Wheat and five Maize. Every object must contain exactly crop_name, timestamp, soil_moisture, temperature, rainfall, sensor_status and notes. Use valid unique timestamps within each crop and mix the chronological order. Use only Online, Offline or Faulty statuses. Include exactly one older reading with one out-of-range numeric value, using the historical Wheat soil_moisture value of 120. Make the latest Tomato Online, Dry and above 35 C; Lettuce Online and Healthy; Wheat Online, Too Wet and rainfall at least 5 mm; and Maize Faulty. Return raw JSON only.

## AI-generated correction and verification

During the assessment review, the historical Wheat outlier had the required `soil_moisture` value of 120, but its other values did not fully follow the supplied worked example. It was corrected to:

- timestamp `2026-08-01T09:00:00`
- temperature `25`
- rainfall `0`
- notes `Intentional invalid test`

The reading remains older than the latest Wheat reading and is still structurally valid. Automated tests verify:

- exactly 20 readings and five readings per crop
- exactly seven fields with the correct types
- valid calendar timestamps and uniqueness within each crop
- mixed array order
- the four required latest-reading cases
- exactly one out-of-range numeric value
- the historical invalid reading is not the latest Wheat reading
- Crop Card CRUD does not modify the sensor file

Codex was also used to help with some guidance, code components and create test to help automate the test to make sure the backend and frontend is working together well.

## Implementation decision

The backend reads and validates `sensor-readings.json` on every `GET /api/readings` request. This allows the sensor file to be replaced during development without restarting Express.

## Limitation

The built-in `DatabaseSync` SQLite API is synchronous. This keeps the assignment code simple, but a long database operation would block the Node.js event loop. It is suitable for this small local dashboard but not for a high-traffic production system.
