// Check the Crop Card request body and return either data or an error message.
export function validateCropPayload(payload, requireCropName = true) {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return { error: "Request body must be a JSON object" };
  }

  // Do not allow fields such as id or created_at to be sent by the user.
  const allowedFields = [
    "crop_name",
    "location",
    "target_min",
    "target_max",
    "normal_water",
    "notes",
  ];
  const extraField = Object.keys(payload).find(
    (field) => !allowedFields.includes(field),
  );
  if (extraField) {
    return { error: `Unsupported field: ${extraField}` };
  }

  if (requireCropName && !Object.hasOwn(payload, "crop_name")) {
    return { error: "crop_name is required" };
  }
  if (
    Object.hasOwn(payload, "crop_name") &&
    typeof payload.crop_name !== "string"
  ) {
    return { error: "crop_name must be a string" };
  }

  if (!Object.hasOwn(payload, "location")) {
    return { error: "location is required" };
  }
  if (
    typeof payload.location !== "string" ||
    payload.location.length < 1 ||
    payload.location.length > 100
  ) {
    return { error: "location must be a string between 1 and 100 characters" };
  }

  // These values must be real JSON numbers, not strings, NaN or Infinity.
  if (!Object.hasOwn(payload, "target_min")) {
    return { error: "target_min is required" };
  }
  if (
    typeof payload.target_min !== "number" ||
    !Number.isFinite(payload.target_min)
  ) {
    return { error: "target_min must be a finite JSON number" };
  }

  if (!Object.hasOwn(payload, "target_max")) {
    return { error: "target_max is required" };
  }
  if (
    typeof payload.target_max !== "number" ||
    !Number.isFinite(payload.target_max)
  ) {
    return { error: "target_max must be a finite JSON number" };
  }

  if (!Object.hasOwn(payload, "normal_water")) {
    return { error: "normal_water is required" };
  }
  if (
    typeof payload.normal_water !== "number" ||
    !Number.isFinite(payload.normal_water)
  ) {
    return { error: "normal_water must be a finite JSON number" };
  }

  if (payload.target_min < 0 || payload.target_min > 100) {
    return { error: "target_min must be between 0 and 100" };
  }
  if (payload.target_max < 0 || payload.target_max > 100) {
    return { error: "target_max must be between 0 and 100" };
  }
  if (payload.target_min >= payload.target_max) {
    return { error: "target_min must be less than target_max" };
  }
  if (payload.normal_water <= 0 || payload.normal_water > 10000) {
    return { error: "normal_water must be greater than 0 and at most 10000" };
  }

  // Notes are optional. If they are missing, save an empty string.
  const notes = Object.hasOwn(payload, "notes") ? payload.notes : "";
  if (typeof notes !== "string" || notes.length > 500) {
    return { error: "notes must be a string with at most 500 characters" };
  }

  return {
    data: {
      ...(Object.hasOwn(payload, "crop_name")
        ? { crop_name: payload.crop_name }
        : {}),
      location: payload.location,
      target_min: payload.target_min,
      target_max: payload.target_max,
      normal_water: payload.normal_water,
      notes,
    },
  };
}
