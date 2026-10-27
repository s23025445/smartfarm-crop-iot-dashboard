import { analyseCrop } from "../utils/analysis.js";

export default function SensorHistory({ crop, readings, onClose }) {
  const history = readings
    .filter((reading) => reading.crop_name === crop.crop_name)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="history-title">
        <div className="modal-heading">
          <h2 id="history-title">{crop.crop_name} Sensor History</h2>
          <button type="button" onClick={onClose}>Close</button>
        </div>

        <p>Showing all readings, newest first.</p>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Moisture</th>
                <th>Temperature</th>
                <th>Rainfall</th>
                <th>Status</th>
                <th>Condition</th>
                <th>Recommended water</th>
                <th>Alerts</th>
                <th>Action</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {history.map((reading) => {
                const result = analyseCrop(crop, reading);
                return (
                  <tr key={reading.timestamp}>
                    <td>{reading.timestamp}</td>
                    <td>{reading.soil_moisture}%</td>
                    <td>{reading.temperature} °C</td>
                    <td>{reading.rainfall} mm</td>
                    <td>{reading.sensor_status}</td>
                    <td>{result.condition}</td>
                    <td>
                      {typeof result.recommended_water === "number"
                        ? `${result.recommended_water} L`
                        : result.recommended_water}
                    </td>
                    <td>{result.alerts.length > 0 ? result.alerts.join(", ") : "None"}</td>
                    <td>{result.action}</td>
                    <td>{reading.notes || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
