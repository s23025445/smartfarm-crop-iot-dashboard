const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

// Send one request and turn backend JSON errors into normal JavaScript errors.
async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong");
  }

  return data;
}

export function getCrops() {
  return request("/crops");
}

export function getReadings() {
  return request("/readings");
}

export function createCrop(crop) {
  return request("/crops", {
    method: "POST",
    body: JSON.stringify(crop),
  });
}

export function updateCrop(id, crop) {
  return request(`/crops/${id}`, {
    method: "PUT",
    body: JSON.stringify(crop),
  });
}

export function deleteCrop(id) {
  return request(`/crops/${id}`, { method: "DELETE" });
}
