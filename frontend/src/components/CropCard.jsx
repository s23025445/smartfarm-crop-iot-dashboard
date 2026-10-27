export default function CropCard({ result, onEdit, onDelete, onHistory }) {
  const { crop, latest_reading: reading } = result;
  const conditionClass =
    result.condition === "N/A"
      ? "not-available"
      : result.condition.toLowerCase().replaceAll(" ", "-");

  return (
    <fieldset className="crop-card">
      <legend>{crop.crop_name}</legend>

      <div className="card-section">
        <h3>Crop Card settings</h3>
        <dl className="details-list">
          <div><dt>Location</dt><dd>{crop.location}</dd></div>
          <div><dt>Target moisture</dt><dd>{crop.target_min}%–{crop.target_max}%</dd></div>
          <div><dt>Normal water</dt><dd>{crop.normal_water} L</dd></div>
          <div><dt>Notes</dt><dd>{crop.notes || "None"}</dd></div>
        </dl>
      </div>

      <div className="card-section">
        <h3>Latest sensor reading</h3>
        {reading ? (
          <dl className="details-list">
            <div><dt>Timestamp</dt><dd>{reading.timestamp}</dd></div>
            <div><dt>Soil moisture</dt><dd>{reading.soil_moisture}%</dd></div>
            <div><dt>Temperature</dt><dd>{reading.temperature} °C</dd></div>
            <div><dt>Rainfall</dt><dd>{reading.rainfall} mm</dd></div>
            <div><dt>Sensor status</dt><dd>{reading.sensor_status}</dd></div>
          </dl>
        ) : (
          <p className="muted">Sensor data is unavailable.</p>
        )}
      </div>

      <div className="result-box">
        <p>
          <strong>Condition:</strong>{" "}
          <span className={`condition condition-${conditionClass}`}>
            {result.condition}
          </span>
        </p>
        <p>
          <strong>Recommended water:</strong>{" "}
          {typeof result.recommended_water === "number"
            ? `${result.recommended_water} L`
            : result.recommended_water}
        </p>
        <p><strong>Action:</strong> {result.action}</p>
        <p>
          <strong>Alerts:</strong>{" "}
          {result.alerts.length > 0 ? result.alerts.join(", ") : "None"}
        </p>
      </div>

      <div className="button-row">
        <button type="button" onClick={() => onEdit(crop)}>Edit</button>
        <button type="button" onClick={() => onDelete(crop)}>Delete</button>
        <button type="button" onClick={() => onHistory(crop)}>
          View Sensor History
        </button>
      </div>
    </fieldset>
  );
}
