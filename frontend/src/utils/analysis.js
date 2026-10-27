// Return crop names from the sensor feed that do not have a Crop Card yet.
export function getAvailableCropNames(readings, crops) {
  if (!readings) {
    return [];
  }

  const sensorCropNames = [...new Set(readings.map((reading) => reading.crop_name))];
  const usedCropNames = crops.map((crop) => crop.crop_name);

  return sensorCropNames.filter((name) => !usedCropNames.includes(name));
}

// Find the greatest timestamp instead of assuming the last array item is newest.
export function getLatestReading(cropName, readings) {
  if (!readings) {
    return null;
  }

  const matchingReadings = readings.filter(
    (reading) => reading.crop_name === cropName,
  );

  return (
    [...matchingReadings].sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp),
    )[0] || null
  );
}

// Combine one Crop Card with one reading by following the assignment priority.
export function analyseCrop(crop, reading) {
  if (!reading) {
    return {
      crop,
      latest_reading: null,
      condition: "N/A",
      recommended_water: "N/A",
      alerts: [],
      action: "N/A",
    };
  }

  if (reading.sensor_status === "Offline" || reading.sensor_status === "Faulty") {
    return {
      crop,
      latest_reading: reading,
      condition: "Sensor Problem",
      recommended_water: "N/A",
      alerts: [`Sensor status: ${reading.sensor_status}`],
      action: "Check sensor",
    };
  }

  const invalidFields = [];
  if (reading.soil_moisture < 0 || reading.soil_moisture > 100) {
    invalidFields.push("soil moisture");
  }
  if (reading.temperature < 0 || reading.temperature > 50) {
    invalidFields.push("temperature");
  }
  if (reading.rainfall < 0 || reading.rainfall > 50) {
    invalidFields.push("rainfall");
  }

  if (invalidFields.length > 0) {
    return {
      crop,
      latest_reading: reading,
      condition: "Invalid Data",
      recommended_water: "N/A",
      alerts: [`Invalid field: ${invalidFields.join(", ")}`],
      action: "Check reading",
    };
  }

  let condition;
  let recommendedWater;
  let action;

  if (reading.soil_moisture < crop.target_min) {
    condition = "Dry";
    recommendedWater = crop.normal_water;
    action = "Water crop";
  } else if (reading.soil_moisture <= crop.target_max) {
    condition = "Healthy";
    recommendedWater = 0;
    action = "Monitor";
  } else {
    condition = "Too Wet";
    recommendedWater = 0;
    action = "Stop watering";
  }

  const alerts = [];
  if (reading.temperature > 35) {
    alerts.push("High temperature");
  }
  if (reading.rainfall >= 5) {
    alerts.push("Rain detected");
  }

  return {
    crop,
    latest_reading: reading,
    condition,
    recommended_water: recommendedWater,
    alerts,
    action,
  };
}

// Work out the single status shown at the top of the dashboard.
export function calculateFarmStatus(results) {
  if (results.length === 0) {
    return "No Crops";
  }

  if (results.every((result) => result.latest_reading === null)) {
    return "Sensor Feed Unavailable";
  }

  if (
    results.some(
      (result) =>
        result.condition === "Sensor Problem" ||
        result.condition === "Invalid Data",
    )
  ) {
    return "Critical";
  }

  if (
    results.some(
      (result) =>
        result.condition === "Dry" ||
        result.condition === "Too Wet" ||
        result.alerts.includes("High temperature"),
    )
  ) {
    return "Watch";
  }

  return "Normal";
}
