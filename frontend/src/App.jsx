import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import CropCard from "./components/CropCard.jsx";
import CropForm from "./components/CropForm.jsx";
import SensorHistory from "./components/SensorHistory.jsx";
import {
  createCrop,
  deleteCrop,
  getCrops,
  getReadings,
  updateCrop,
} from "./services/api.js";
import {
  analyseCrop,
  calculateFarmStatus,
  getAvailableCropNames,
  getLatestReading,
} from "./utils/analysis.js";

export default function App() {
  const [crops, setCrops] = useState([]);
  const [readings, setReadings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cropError, setCropError] = useState("");
  const [sensorError, setSensorError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [lastRefresh, setLastRefresh] = useState("Never");
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formState, setFormState] = useState(null);
  const [historyCropId, setHistoryCropId] = useState(null);

  const loadPage = useCallback(async () => {
    const [cropResult, sensorResult] = await Promise.allSettled([
      getCrops(),
      getReadings(),
    ]);

    if (cropResult.status === "fulfilled") {
      setCrops(cropResult.value);
    } else {
      setCropError(cropResult.reason.message);
    }

    if (sensorResult.status === "fulfilled") {
      setReadings(sensorResult.value);
      setLastRefresh(new Date().toLocaleString());
    } else {
      setReadings(null);
      setLastRefresh("Never");
      setSensorError(sensorResult.reason.message);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    Promise.resolve().then(loadPage);
  }, [loadPage]);

  const availableCropNames = useMemo(
    () => getAvailableCropNames(readings, crops),
    [readings, crops],
  );

  const results = useMemo(
    () =>
      crops.map((crop) =>
        analyseCrop(crop, getLatestReading(crop.crop_name, readings)),
      ),
    [crops, readings],
  );

  const farmStatus = calculateFarmStatus(results);
  const historyCrop = crops.find((crop) => crop.id === historyCropId) || null;

  async function refreshSensors() {
    setRefreshing(true);
    setSensorError("");

    try {
      const newReadings = await getReadings();
      setReadings(newReadings);
      setLastRefresh(new Date().toLocaleString());
      setSuccessMessage("Sensor data refreshed successfully.");
    } catch (error) {
      // Keep the previous successful readings when a later refresh fails.
      setSensorError(error.message);
    } finally {
      setRefreshing(false);
    }
  }

  async function saveCrop(cropData) {
    setSaving(true);
    setSuccessMessage("");

    try {
      if (formState.type === "edit") {
        const updatedCrop = await updateCrop(formState.crop.id, cropData);
        setCrops((current) =>
          current.map((crop) => (crop.id === updatedCrop.id ? updatedCrop : crop)),
        );
        setSuccessMessage(`${updatedCrop.crop_name} was updated successfully.`);
      } else {
        const newCrop = await createCrop(cropData);
        setCrops((current) => [...current, newCrop]);
        setSuccessMessage(`${newCrop.crop_name} was created successfully.`);
      }

      setFormState(null);
    } finally {
      setSaving(false);
    }
  }

  async function removeCrop(crop) {
    const confirmed = window.confirm(
      `Delete the ${crop.crop_name} Crop Card? Sensor readings will not be deleted.`,
    );
    if (!confirmed) {
      return;
    }

    setSuccessMessage("");
    setCropError("");

    try {
      await deleteCrop(crop.id);
      setCrops((current) => current.filter((item) => item.id !== crop.id));
      setSuccessMessage(`${crop.crop_name} was deleted successfully.`);
      if (historyCropId === crop.id) {
        setHistoryCropId(null);
      }
    } catch (error) {
      setCropError(error.message);
    }
  }

  if (loading) {
    return (
      <main className="page-shell">
        <h1>SmartFarm Crop Dashboard</h1>
        <p className="message">Loading Crop Cards and sensor readings...</p>
      </main>
    );
  }

  if (cropError && crops.length === 0) {
    return (
      <main className="page-shell">
        <h1>SmartFarm Crop Dashboard</h1>
        <div className="message error-message">
          <strong>Crop Cards could not be loaded.</strong>
          <p>{cropError}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setCropError("");
              setSensorError("");
              loadPage();
            }}
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <header className="page-header">
        <h1>SmartFarm Crop Dashboard</h1>
        <p>Crop Card Management and IoT Sensor Monitoring</p>
      </header>

      <fieldset className="summary-panel">
        <legend>Farm summary</legend>
        <div className="summary-grid">
          <div><strong>Overall Farm Status</strong><span className={`farm-status status-${farmStatus.toLowerCase().replaceAll(" ", "-")}`}>{farmStatus}</span></div>
          <div><strong>Crop Cards</strong><span>{crops.length}</span></div>
          <div><strong>Last sensor refresh</strong><span>{lastRefresh}</span></div>
        </div>
        <div className="button-row summary-actions">
          <button
            type="button"
            onClick={() => setFormState({ type: "create" })}
            disabled={!readings || availableCropNames.length === 0}
          >
            Add Crop Card
          </button>
          <button type="button" onClick={refreshSensors} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh Sensor Data"}
          </button>
        </div>
        {!readings && (
          <p className="muted">Add Crop Card is disabled until sensor data loads successfully.</p>
        )}
        {readings && availableCropNames.length === 0 && (
          <p className="muted">Every sensor crop already has a Crop Card.</p>
        )}
      </fieldset>

      {sensorError && (
        <div className="message error-message">
          <strong>Sensor feed error:</strong> {sensorError}
        </div>
      )}
      {cropError && (
        <div className="message error-message">
          <strong>Crop Card error:</strong> {cropError}
        </div>
      )}
      {successMessage && <div className="message success-message">{successMessage}</div>}

      {formState && (
        <CropForm
          key={formState.type === "edit" ? formState.crop.id : "create"}
          crop={formState.type === "edit" ? formState.crop : null}
          cropNames={availableCropNames}
          onSave={saveCrop}
          onCancel={() => setFormState(null)}
          saving={saving}
        />
      )}

      <section className="dashboard-section">
        <h2>Crop Cards</h2>
        {results.length === 0 ? (
          <div className="empty-state">
            <h3>No Crop Cards</h3>
            <p>Create a Crop Card to begin monitoring the farm.</p>
          </div>
        ) : (
          <div className="crop-grid">
            {results.map((result) => (
              <CropCard
                key={result.crop.id}
                result={result}
                onEdit={(crop) => setFormState({ type: "edit", crop })}
                onDelete={removeCrop}
                onHistory={(crop) => setHistoryCropId(crop.id)}
              />
            ))}
          </div>
        )}
      </section>

      {historyCrop && readings && (
        <SensorHistory
          crop={historyCrop}
          readings={readings}
          onClose={() => setHistoryCropId(null)}
        />
      )}
    </main>
  );
}
