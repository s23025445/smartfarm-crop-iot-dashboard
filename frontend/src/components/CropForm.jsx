import { useState } from "react";

const cropDefaults = {
  Tomato: { location: "Greenhouse A", target_min: 55, target_max: 75, normal_water: 500 },
  Lettuce: { location: "Greenhouse B", target_min: 60, target_max: 80, normal_water: 400 },
  Wheat: { location: "North Field", target_min: 35, target_max: 55, normal_water: 300 },
  Maize: { location: "South Field", target_min: 50, target_max: 70, normal_water: 600 },
};

function getStartingValues(crop, cropNames) {
  if (crop) {
    return {
      crop_name: crop.crop_name,
      location: crop.location,
      target_min: String(crop.target_min),
      target_max: String(crop.target_max),
      normal_water: String(crop.normal_water),
      notes: crop.notes,
    };
  }

  const cropName = cropNames[0] || "";
  const defaults = cropDefaults[cropName] || {
    location: "",
    target_min: "",
    target_max: "",
    normal_water: "",
  };

  return {
    crop_name: cropName,
    location: defaults.location,
    target_min: String(defaults.target_min),
    target_max: String(defaults.target_max),
    normal_water: String(defaults.normal_water),
    notes: "",
  };
}

export default function CropForm({ crop, cropNames, onSave, onCancel, saving }) {
  const [form, setForm] = useState(() => getStartingValues(crop, cropNames));
  const [error, setError] = useState("");
  const isEditing = Boolean(crop);

  function changeField(event) {
    const { name, value } = event.target;

    if (name === "crop_name" && !isEditing) {
      const defaults = cropDefaults[value];
      setForm((current) => ({
        ...current,
        crop_name: value,
        location: defaults.location,
        target_min: String(defaults.target_min),
        target_max: String(defaults.target_max),
        normal_water: String(defaults.normal_water),
      }));
      return;
    }

    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submitForm(event) {
    event.preventDefault();
    setError("");

    if (!form.crop_name) {
      setError("Please select a crop name.");
      return;
    }
    if (form.location.length < 1 || form.location.length > 100) {
      setError("Location must be between 1 and 100 characters.");
      return;
    }
    if (form.notes.length > 500) {
      setError("Notes must be 500 characters or fewer.");
      return;
    }

    const targetMin = Number(form.target_min);
    const targetMax = Number(form.target_max);
    const normalWater = Number(form.normal_water);

    if (
      form.target_min === "" ||
      form.target_max === "" ||
      form.normal_water === "" ||
      !Number.isFinite(targetMin) ||
      !Number.isFinite(targetMax) ||
      !Number.isFinite(normalWater)
    ) {
      setError("Target values and normal water must be numbers.");
      return;
    }
    if (targetMin < 0 || targetMin > 100 || targetMax < 0 || targetMax > 100) {
      setError("Target values must be between 0 and 100.");
      return;
    }
    if (targetMin >= targetMax) {
      setError("Target minimum must be less than target maximum.");
      return;
    }
    if (normalWater <= 0 || normalWater > 10000) {
      setError("Normal water must be greater than 0 and at most 10000.");
      return;
    }

    try {
      await onSave({
        crop_name: form.crop_name,
        location: form.location,
        target_min: targetMin,
        target_max: targetMax,
        normal_water: normalWater,
        notes: form.notes,
      });
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal-panel form-panel form-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crop-form-title"
      >
        <div className="modal-heading">
          <h2 id="crop-form-title">
            {isEditing ? `Edit ${crop.crop_name}` : "Add Crop Card"}
          </h2>
          <button type="button" onClick={onCancel} disabled={saving}>Close</button>
        </div>

        <form onSubmit={submitForm}>
          <fieldset>
            <legend>Crop information</legend>

          <label htmlFor="crop_name">Crop name</label>
          {isEditing ? (
            <input id="crop_name" value={form.crop_name} readOnly />
          ) : (
            <select
              id="crop_name"
              name="crop_name"
              value={form.crop_name}
              onChange={changeField}
            >
              {cropNames.map((name) => <option key={name}>{name}</option>)}
            </select>
          )}

          <label htmlFor="location">Location</label>
          <input
            id="location"
            name="location"
            value={form.location}
            onChange={changeField}
            maxLength="100"
            required
          />

          <div className="form-columns">
            <div>
              <label htmlFor="target_min">Target minimum (%)</label>
              <input
                id="target_min"
                name="target_min"
                type="number"
                min="0"
                max="100"
                step="any"
                value={form.target_min}
                onChange={changeField}
                required
              />
            </div>
            <div>
              <label htmlFor="target_max">Target maximum (%)</label>
              <input
                id="target_max"
                name="target_max"
                type="number"
                min="0"
                max="100"
                step="any"
                value={form.target_max}
                onChange={changeField}
                required
              />
            </div>
          </div>

          <label htmlFor="normal_water">Normal water (L)</label>
          <input
            id="normal_water"
            name="normal_water"
            type="number"
            min="0.01"
            max="10000"
            step="any"
            value={form.normal_water}
            onChange={changeField}
            required
          />

          <label htmlFor="notes">Notes (optional)</label>
          <textarea
            id="notes"
            name="notes"
            rows="4"
            value={form.notes}
            onChange={changeField}
            maxLength="500"
          />
          </fieldset>

          {error && <p className="message error-message">{error}</p>}

          <div className="button-row">
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Crop Card"}
            </button>
            <button type="button" onClick={onCancel} disabled={saving}>Cancel</button>
          </div>
        </form>
      </section>
    </div>
  );
}
