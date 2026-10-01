import { useMemo, useRef, useState } from "react";
import "./App.css";

const API = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";

const CROPS = [
  { id: "Tomato", emoji: "", latin: "Solanum" },
  { id: "Potato", emoji: "", latin: "Solanum" },
  { id: "Corn (Maize)", api: "Corn (Maize)", emoji: "", latin: "Zea" },
  { id: "Apple", emoji: "", latin: "Malus" },
  { id: "Grapevine", api: "Grape", emoji: "", latin: "Vitis" },
  { id: "Bell Pepper", api: "Pepper, bell", emoji: "", latin: "Capsicum" },
];

const DEMOS = [
  { name: "Early Blight", crop: "Tomato", file: "/demo/early-blight.jpg", place: "Demo Field" },
  { name: "Healthy", crop: "Tomato", file: "/demo/healthy.jpg", place: "Demo Field" },
  { name: "Late Blight", crop: "Potato", file: "/demo/late-blight.jpg", place: "Demo Field" },
  { name: "Common Rust", crop: "Corn (Maize)", file: "/demo/common-rust.jpg", place: "Demo Field" },
];

const HUBS = [
  ["Salinas Valley, CA (USA)", 36.6777, -121.6555],
  ["Iowa Corn Belt (USA)", 42.0308, -93.6319],
  ["Punjab Agricultural Belt (India)", 30.9010, 75.8573],
  ["Bordeaux Vineyard Region (France)", 44.8378, -0.5792],
  ["Rift Valley Highlands (Kenya)", -0.3031, 36.0800],
  ["Mendoza Wine Region (Argentina)", -32.8895, -68.8458],
];

const friendly = (value = "") =>
  value
    .replaceAll("___", "  ")
    .replaceAll("_", " ")
    .replaceAll("(", "")
    .replaceAll(")", "")
    .replaceAll(",", ", ")
    .replace(/\s+/g, " ")
    .trim();

function cropFromPrediction(value = "") {
  const v = value.toLowerCase();
  if (v.includes("tomato")) return "Tomato";
  if (v.includes("potato")) return "Potato";
  if (v.includes("corn") || v.includes("maize")) return "Corn (Maize)";
  if (v.includes("apple")) return "Apple";
  if (v.includes("grape")) return "Grapevine";
  if (v.includes("pepper")) return "Bell Pepper";
  return "Unknown";
}

function percent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return `${n > 1 ? n.toFixed(2) : (n * 100).toFixed(2)}%`;
}

function getErrorMessage(data, fallback = "Request failed") {
  if (data == null) return fallback;
  if (typeof data === "string") {
    return data;
  }
  if (data instanceof Error && data.message) {
    return data.message;
  }
  if (typeof data.detail === "string") {
    return data.detail;
  }
  if (typeof data.error === "string") {
    return data.error;
  }
  if (typeof data.message === "string") {
    return data.message;
  }
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item.msg === "string") return item.msg;
        try {
          return JSON.stringify(item);
        } catch {
          return String(item);
        }
      })
      .join("; ");
  }
  try {
    return JSON.stringify(data);
  } catch {
    return fallback;
  }
}function normalizeSoil(data) {
  if (!data) return null;
  if (data.properties && typeof data.properties === "object") {
    return { properties: data.properties, source: data.source, available: data.success ?? data.available ?? true };
  }
  const properties = {};
  if (data.pH != null || data.ph != null) properties.pH = data.pH ?? data.ph;
  if (data.clay != null) properties.Clay = data.clay;
  if (data.sand != null) properties.Sand = data.sand;
  if (data.silt != null) properties.Silt = data.silt;
  if (data.soc != null || data.organicCarbon != null) properties["Organic Carbon"] = data.soc ?? data.organicCarbon;
  return { properties, source: data.source, available: data.available ?? true };
}

function soilUnit(key) {
  if (key.toLowerCase().includes("organic")) return "g/kg";
  if (key.toLowerCase() === "ph") return "";
  return "%";
}

function App() {
  const [page, setPage] = useState("analyze");
  const [crop, setCrop] = useState("Tomato");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [lat, setLat] = useState(20.5937);
  const [lon, setLon] = useState(78.9629);
  const [locationName, setLocationName] = useState("India");
  const [result, setResult] = useState(null);
  const [weather, setWeather] = useState(null);
  const [soil, setSoil] = useState(null);
  const [nasa, setNasa] = useState(null);
  const [gradcam, setGradcam] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const cameraRef = useRef(null);

  const selectedCrop = useMemo(() => CROPS.find(c => c.id === crop), [crop]);

  const setImage = (nextFile) => {
    if (!nextFile) return;
    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
    setResult(null);
    setGradcam(null);
    setError("");
  };

  const chooseDemo = async (demo) => {
    try {
      const response = await fetch(demo.file);
      const blob = await response.blob();
      const demoFile = new File([blob], `${demo.name.toLowerCase().replaceAll(" ", "-")}.jpg`, { type: blob.type || "image/jpeg" });
      setCrop(demo.crop);
      setImage(demoFile);
    } catch {
      setError("Could not load the demo image. Check that public/demo contains the four demo files.");
    }
  };

  const useGPS = () => {
    if (!navigator.geolocation) {
      setError("Browser GPS is not available.");
      return;
    }
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(Number(position.coords.latitude.toFixed(6)));
        setLon(Number(position.coords.longitude.toFixed(6)));
        setLocationName("Current GPS");
      },
      () => setError("GPS permission was denied or unavailable. You can enter coordinates manually.")
    );
  };

  const callJSON = async (path) => {
    const response = await fetch(`${API}${path}`);
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(`Server returned HTTP ${response.status}`);
    }
    if (!response.ok) {
      throw new Error(
        getErrorMessage(data, `Request failed: ${response.status}`)
      );
    }
    return data;
  };

  const analyze = async () => {
    if (!file) {
      setError("Select a leaf image or choose a demo leaf first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setGradcam(null);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("crop", selectedCrop?.api || crop);
      form.append("latitude", String(lat));
      form.append("longitude", String(lon));

      const predictionResponse = await fetch(`${API}/predict`, { method: "POST", body: form });
      const prediction = await predictionResponse.json();
      if (!predictionResponse.ok || prediction.success === false) {
        throw new Error(
          getErrorMessage(prediction, "Prediction failed.")
        );
      }
      setResult(prediction);

      const queries = `?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}`;
      const [w, s, n] = await Promise.allSettled([
        callJSON(`/weather${queries}`),
        callJSON(`/soil${queries}`),
        callJSON(`/nasa${queries}`),
      ]);
      if (w.status === "fulfilled") setWeather(w.value);
      if (s.status === "fulfilled") setSoil(normalizeSoil(s.value));
      if (n.status === "fulfilled") setNasa(n.value);

      if (prediction.gradcam_image || prediction.gradcamImage) {
        setGradcam(prediction.gradcam_image || prediction.gradcamImage);
      } else {
        const g = await Promise.allSettled([
          (async () => {
            const gf = new FormData();
            gf.append("file", file);
            if (prediction.class_index != null) gf.append("target_index", String(prediction.class_index));
            return callGradcam(gf);
          })(),
        ]);
        if (g[0].status === "fulfilled") {
          const gd = g[0].value;
          setGradcam(gd.overlay || gd.gradcam || gd.image || gd.overlay_image || null);
        }
      }
    } catch (e) {
      console.error("AgriVision analysis error:", e);
      const message =
        e instanceof Error
          ? e.message
          : getErrorMessage(e, "Analysis failed.");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const callGradcam = async (form) => {
    const response = await fetch(`${API}/gradcam`, { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok || data.success === false) {
      throw new Error(
        getErrorMessage(data, "Grad-CAM unavailable")
      );
    }
    return data;
  };

  const downloadJSON = () => {
    if (!result) return;
    const payload = { result, weather, soil, nasa, coordinates: { latitude: lat, longitude: lon } };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `agrivision-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const predictionLabel = result?.prediction || result?.disease || "";
  const confidence = result?.confidence ?? result?.probability;
  const detectedCrop = result?.crop || cropFromPrediction(predictionLabel);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" onClick={() => setPage("dashboard")}>
          <div className="brand-mark">AI</div>
          <div>
            <div className="brand-name">AgriVision AI <span>MVP V1.0</span></div>
            <div className="brand-sub">Multimodal Crop Health & Farm Assistant</div>
          </div>
        </div>
        <nav>
          {[
            ["dashboard", "", "Dashboard"],
            ["analyze", "", "Analyze Crop"],
            ["history", "", "History"],
            ["about", "", "About"],
          ].map(([id, icon, label]) => (
            <button key={id} className={page === id ? "nav-active" : ""} onClick={() => setPage(id)}>
              {icon} {label}
            </button>
          ))}
        </nav>
        <div className="online"><i /> Online</div>
      </header>

      {page !== "analyze" ? (
        <main className="simple-page">
          <div className="eyebrow">AGRI VISION AI</div>
          <h1>{page === "dashboard" ? "Field Diagnostics Dashboard" : page === "history" ? "Scan History" : "About AgriVision AI"}</h1>
          <p className="muted">Use Analyze Crop to run the live diagnostic workflow.</p>
          <button className="primary-btn" onClick={() => setPage("analyze")}>Open Analyze Crop </button>
        </main>
      ) : (
        <main className="page">
          <section className="hero">
            <div>
              <div className="eyebrow"> AI-POWERED FIELD DIAGNOSTICS</div>
              <h1>Crop Diagnostic & <span>Environmental Assessment</span></h1>
              <p>Upload a leaf specimen to classify diseases and contextualize the diagnosis with real-time weather and agroclimatology.</p>
            </div>
            <div className="model-chip"> <b>MobileNetV3</b> <small>18 classes</small></div>
          </section>

          <section className="panel workflow">
            <div className="section-heading">
              <div><h2> Analyze Crop</h2><p>Select the crop and provide a clear image of the affected leaf.</p></div>
              <span className="trained"> Trained Model</span>
            </div>

            <label className="label">Target Crop Species <em>*</em></label>
            <div className="crop-grid">
              {CROPS.map(c => (
                <button key={c.id} className={`crop-card ${crop === c.id ? "selected" : ""}`} onClick={() => setCrop(c.id)}>
                  <strong>{c.emoji}</strong>
                  <b>{c.id}</b>
                  <small>{c.latin}</small>
                  {crop === c.id && <i></i>}
                </button>
              ))}
            </div>

            <label className="label specimen-label">Plant / Leaf Specimen <em>*</em><span>Supports JPG, PNG up to 10MB</span></label>
            <div
              className="dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); setImage(e.dataTransfer.files?.[0]); }}
              onClick={() => inputRef.current?.click()}
            >
              {preview ? <img src={preview} alt="Leaf preview" /> : (
                <>
                  <div className="upload-icon"></div>
                  <b>Drag & drop photo, or <span>browse</span></b>
                  <small>Position leaf flat against a neutral background with clear natural<br/>illumination for best accuracy.</small>
                </>
              )}
              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/jpg" hidden onChange={(e) => setImage(e.target.files?.[0])} />
              {preview && <div className="preview-overlay">Click to replace image</div>}
            </div>

            <div className="action-row">
              <button className="secondary-btn" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}> Select File</button>
              <button className="secondary-btn" onClick={(e) => { e.stopPropagation(); cameraRef.current?.click(); }}> Capture with Camera</button>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => setImage(e.target.files?.[0])} />
            </div>

            <div className="demo-header"><b> Quick Demo Leaves <small>(Judge 1-Click Testing)</small></b><span>PlantVillage benchmark</span></div>
            <div className="demo-grid">
              {DEMOS.map(d => (
                <button className="demo-card" key={d.name} onClick={() => chooseDemo(d)}>
                  <img src={d.file} alt={d.name} />
                  <div><b>{d.name}</b><small>{d.place}</small></div><strong></strong>
                </button>
              ))}
            </div>

            <div className="location-title"><b> Field Location & Microclimate Coordinates</b><button onClick={useGPS}> Use My GPS</button></div>
            <div className="hub-row">
              {HUBS.map(([name, a, b]) => (
                <button key={name} className={locationName === name ? "hub selected-hub" : "hub"} onClick={() => { setLat(a); setLon(b); setLocationName(name); }}>{name}</button>
              ))}
            </div>
            <div className="coords">
              <label>Latitude (N)<input value={lat} onChange={e => { setLat(e.target.value); setLocationName("Custom coordinates"); }} /></label>
              <label>Longitude (E)<input value={lon} onChange={e => { setLon(e.target.value); setLocationName("Custom coordinates"); }} /></label>
            </div>
            {locationName && <div className="selected-location">Selected location: <b>{locationName}</b></div>}

            {error && <div className="error-box"> {error}</div>}

            <button className={`analyze-btn ${!file || loading ? "disabled" : ""}`} disabled={!file || loading} onClick={analyze}>
              {loading ? "Analyzing crop & environment" : " Analyze Crop & Environment  "}
            </button>
          </section>

          {(result || loading) && (
            <section className="results">
              {loading && <div className="loading-card">Running AI diagnosis and environmental assessment</div>}

              {result && (
                <>
                  <div className="result-panel">
                    <div className="section-heading">
                      <div><h2> AI Diagnosis Result</h2><p>Prediction from the trained MobileNetV3 model.</p></div>
                      <div className="result-actions"><button onClick={downloadJSON}>JSON</button><button onClick={() => window.print()}>PDF / Print</button></div>
                    </div>
                    <div className="diagnosis-grid">
                      <div className="diagnosis-main">
                        <span className="status-pill">{String(predictionLabel).toLowerCase().includes("healthy") ? "HEALTHY" : "DISEASE DETECTED"}</span>
                        <h2>{friendly(predictionLabel)}</h2>
                        <p>Detected crop: <b>{detectedCrop}</b></p>
                        <div className="confidence"><span>Model confidence</span><b>{percent(confidence)}</b></div>
                        <div className="meter"><i style={{width: `${Math.min(100, Number(confidence) > 1 ? Number(confidence) : Number(confidence) * 100)}%`}} /></div>
                      </div>
                      <div className="top-preds">
                        <b>Top predictions</b>
                        {(result.top_predictions || result.topPredictions || []).slice(0, 3).map((p, i) => (
                          <div key={i}><span>{friendly(p.class || p.label)}</span><b>{percent(p.confidence)}</b></div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="result-panel">
                    <div className="section-heading"><div><h2> Explainable AI  Grad-CAM Saliency Map</h2><p>Visual attention associated with the predicted class.</p></div></div>
                    <div className="xai-view">
                      {gradcam ? <img src={gradcam} alt="Grad-CAM saliency overlay" /> : <div className="xai-empty">Grad-CAM is unavailable for this scan. The diagnosis itself remains available.</div>}
                    </div>
                  </div>

                  <div className="insight-panel">
                    <div className="section-heading"><div><h2> Multimodal Farm Insights</h2><p>Environmental context collected for the selected field coordinates.</p></div><span className="live-badge">LIVE DATA</span></div>
                    <div className="metric-grid">
                      <Metric label="Temperature" value={weather?.temperature != null ? `${weather.temperature} C` : ""} source="Open-Meteo" />
                      <Metric label="Relative Humidity" value={weather?.humidity != null ? `${weather.humidity}%` : ""} source="Open-Meteo" />
                      <Metric label="Wind Speed" value={weather?.wind_speed != null ? `${weather.wind_speed} km/h` : weather?.windSpeed != null ? `${weather.windSpeed} km/h` : ""} source="Open-Meteo" />
                      <Metric label="Solar Radiation" value={nasa?.solar_radiation != null ? `${nasa.solar_radiation} kWh/m/day` : nasa?.solarRadiation != null ? `${nasa.solarRadiation} kWh/m/day` : ""} source="NASA POWER" />
                    </div>
                    <div className="assessment"> <b>Environmental assessment</b><span>Current environmental data are shown as field context alongside the AI diagnosis.</span></div>
                  </div>

                  <div className="result-panel">
                    <div className="section-heading"><div><h2> Weather Telemetry</h2><p>Open-Meteo current conditions.</p></div><span className="live-badge">LIVE</span></div>
                    <div className="metric-grid four">
                      <Metric label="Temperature" value={weather?.temperature != null ? `${weather.temperature} C` : ""} />
                      <Metric label="Humidity" value={weather?.humidity != null ? `${weather.humidity}%` : ""} />
                      <Metric label="Wind Speed" value={weather?.wind_speed != null ? `${weather.wind_speed} km/h` : weather?.windSpeed != null ? `${weather.windSpeed} km/h` : ""} />
                      <Metric label="Precipitation" value={weather?.precipitation != null ? `${weather.precipitation} mm` : ""} />
                    </div>
                  </div>

                  <div className="result-panel">
                    <div className="section-heading"><div><h2> ISRIC SoilGrids</h2><p>Soil chemistry and texture for the selected coordinates.</p></div><span className="live-badge neutral">ISRIC</span></div>
                    {soil?.available !== false && soil?.properties && Object.keys(soil.properties).length ? (
                      <div className="soil-grid">
                        {Object.entries(soil.properties).map(([key, value]) => <Metric key={key} label={key} value={`${value}${soilUnit(key) ? ` ${soilUnit(key)}` : ""}`} />)}
                      </div>
                    ) : <div className="unavailable"> SoilGrids temporarily unavailable. Soil data could not be queried for these coordinates.</div>}
                  </div>

                  <div className="result-panel">
                    <div className="section-heading"><div><h2> NASA POWER</h2><p>Satellite-derived agroclimatology.</p></div><span className="live-badge neutral">NASA</span></div>
                    <div className="metric-grid four">
                      <Metric label="Solar Radiation" value={nasa?.solar_radiation != null ? `${nasa.solar_radiation} kWh/m/day` : nasa?.solarRadiation != null ? `${nasa.solarRadiation} kWh/m/day` : ""} />
                      <Metric label="Daily Temperature" value={nasa?.daily_temperature != null ? `${nasa.daily_temperature} C` : nasa?.surface_temperature != null ? `${nasa.surface_temperature} C` : nasa?.surfaceTemperature != null ? `${nasa.surfaceTemperature} C` : ""} />
                      <Metric label="Daily Humidity" value={nasa?.daily_humidity != null ? `${nasa.daily_humidity}%` : nasa?.relative_humidity != null ? `${nasa.relative_humidity}%` : nasa?.relativeHumidity != null ? `${nasa.relativeHumidity}%` : ""} />
                      <Metric label="Precipitation" value={nasa?.precipitation != null ? `${nasa.precipitation} mm` : ""} />
                    </div>
                  </div>

                  <div className="next-panel">
                    <div className="section-heading"><div><h2> Recommended Next Steps</h2><p>Agronomic protocol associated with the detected disease class.</p></div></div>
                    <div className="next-grid">
                      <div className="protocol"><b> Immediate Field Action</b><p>{result.advice || result.recommendation || "Inspect affected plants and monitor the vineyard/field closely during humid or wet conditions."}</p></div>
                      <div>
                        <div className="step"><b>01&nbsp; Inspect</b><span>Check additional plants and compare symptomatic areas in the field.</span></div>
                        <div className="step"><b>02&nbsp; Document</b><span>Record the diagnosis, image and environmental conditions for follow-up.</span></div>
                        <div className="step"><b>03&nbsp; Verify</b><span>Use local agronomic guidance before applying any treatment.</span></div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>
          )}
        </main>
      )}
    </div>
  );
}

function Metric({ label, value, source }) {
  return <div className="metric"><small>{label}</small><strong>{value}</strong>{source && <em>{source}</em>}</div>;
}

export default App;


