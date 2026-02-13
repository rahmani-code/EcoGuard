

/* ============================================================
   ADAFRUIT CLOUD CONFIGURATION
   ------------------------------------------------------------
   These values connect the dashboard to Adafruit IO.
   ============================================================ */

const AIO_USERNAME = "username";
const AIO_KEY = "Pass";
const AIO_BASE = `https://io.adafruit.com/api/v2/${AIO_USERNAME}/feeds`;

let lastDataTimestamp = 0;

/* ============================================================
      2. OUR BIN CALIBRATION & SYSTEM THRESHOLDS
      ------------------------------------------------------------
      These values MUST match the ESP32 calibration.
      If we change bin size physically, we update these.
      ============================================================ */

const EMPTY_DIST_CM = 30;
const FULL_DIST_CM = 5;
const FULL_THRESHOLD_PERCENT = 95;

/* ============================================================
      3. DASHBOARD STATE (Frontend Memory)
      ============================================================ */

let totalSorted = 0;
let lastSorted = "None";

let distanceNow = 0;
let sortLog = [];
let currentFilter = "all";

/* ============================================================
      4. DOM REFERENCES
      ============================================================ */

const elDistanceCm = document.getElementById("distanceCm");
const elDistanceCm2 = document.getElementById("distanceCm2");
const elFillPercent = document.getElementById("fillPercent");
const elBarFill = document.getElementById("barFill");

const elSystemStatusText = document.getElementById("systemStatusText");
const elSystemStatusSub = document.getElementById("systemStatusSub");
const elStatusBadge = document.getElementById("statusBadge");

const elLastSorted = document.getElementById("lastSorted");
const elTotalSorted = document.getElementById("totalSorted");
const elSortLog = document.getElementById("sortLog");

/* ============================================================
      5. MODAL FOR MANUAL SORTING 
      ============================================================ */

const modal = document.getElementById("sortModal");

document.getElementById("openSort").onclick = () =>
  (modal.style.display = "flex");

document.getElementById("closeSort").onclick = () =>
  (modal.style.display = "none");

// Close modal if background clicked
modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.style.display = "none";
});

// Manual sort options
document.querySelectorAll(".opt").forEach((btn) => {
  btn.addEventListener("click", () => {
    handleManualSort(btn.dataset.type);
    modal.style.display = "none";
  });
});

// Log filter chips
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document
      .querySelectorAll(".chip")
      .forEach((c) => c.classList.remove("active"));

    chip.classList.add("active");
    currentFilter = chip.dataset.filter;
    renderSortLog();
  });
});

/* ============================================================
      6. HELPER FUNCTIONS
      ============================================================ */

// Ensures value stays within range
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// Convert distance (cm) → fill percentage (0–100%)
function distanceToPercent(distanceCm) {
  if (distanceCm >= EMPTY_DIST_CM) return 0;
  if (distanceCm <= FULL_DIST_CM) return 100;

  const pct =
    ((EMPTY_DIST_CM - distanceCm) / (EMPTY_DIST_CM - FULL_DIST_CM)) * 100;

  return clamp(Math.round(pct), 0, 100);
}

// Updates badge + status message visually
function updateStatusUI(status) {
  elStatusBadge.textContent = status;

  if (status === "FULL") {
    elStatusBadge.style.background = "var(--danger-2)";
    elStatusBadge.style.color = "var(--danger)";
    elSystemStatusText.textContent = "Full";
    elSystemStatusSub.textContent = "Bin capacity exceeded threshold";
  } else if (status === "WARNING") {
    elStatusBadge.style.background = "var(--warn-2)";
    elStatusBadge.style.color = "#b45309";
    elSystemStatusText.textContent = "Warning";
    elSystemStatusSub.textContent = "Sensor or data issue detected";
  } else {
    elStatusBadge.style.background = "var(--green-2)";
    elStatusBadge.style.color = "#1f5f48";
    elSystemStatusText.textContent = "Operational";
    elSystemStatusSub.textContent = "Bin operating normally";
  }
}

// Returns formatted time (HH:MM)
function nowTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ============================================================
      7. RENDER FUNCTIONS
      ============================================================ */

function renderMetrics(percent, sensorOk) {
  elDistanceCm.textContent = distanceNow;
  elDistanceCm2.textContent = distanceNow;

  elFillPercent.textContent = percent;
  elBarFill.style.width = `${percent}%`;

  elLastSorted.textContent = lastSorted;
  elTotalSorted.textContent = totalSorted;

  // ---- Status Logic ----
  let status = "OPERATIONAL";

  if (!sensorOk) {
    status = "WARNING";
  } else if (percent >= FULL_THRESHOLD_PERCENT) {
    status = "FULL";
  }

  updateStatusUI(status);
}

function renderSortLog() {
  elSortLog.innerHTML = "";

  const filtered = sortLog.filter((e) =>
    currentFilter === "all" ? true : e.type === currentFilter
  );

  if (filtered.length === 0) {
    elSortLog.innerHTML = `<li><div class="li-left">
           <span class="tag">—</span>
           <span>No sorting activity yet</span>
          </div>
          <span class="time">${nowTime()}</span></li>`;
    return;
  }

  filtered.slice(0, 12).forEach((entry) => {
    const li = document.createElement("li");

    li.innerHTML = `
         <div class="li-left">
           <span class="tag">${entry.type.toUpperCase()}</span>
           <span>Sorted (manual)</span>
         </div>
         <span class="time">${entry.time}</span>
       `;

    elSortLog.appendChild(li);
  });
}

/* ============================================================
      8. CHART
      ============================================================ */

const chart = new Chart(document.getElementById("distanceChart"), {
  type: "line",
  data: {
    labels: [],
    datasets: [
      {
        label: "Fullness (%)",
        data: [],
        borderColor: "#2ea37a",
        backgroundColor: "rgba(46,163,122,0.12)",
        tension: 0.35,
        fill: true,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { min: 0, max: 100 },
    },
    plugins: { legend: { display: false } },
  },
});

document.querySelector(".chart-wrap").style.height = "220px";

function pushChartPoint(percent) {
  chart.data.labels.push(nowTime());
  chart.data.datasets[0].data.push(percent);

  if (chart.data.labels.length > 12) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }

  chart.update();
}

/* ============================================================
      9. CLOUD COMMUNICATION
      ============================================================ */

// POST data to Adafruit feed
async function sendToFeed(feed, value) {
  await fetch(`${AIO_BASE}/${feed}/data`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-AIO-Key": AIO_KEY,
    },
    body: JSON.stringify({ value }),
  });
}

// Fetch latest value from a feed
async function fetchFeed(feedName) {
  const res = await fetch(`${AIO_BASE}/${feedName}/data/last`, {
    headers: { "X-AIO-Key": AIO_KEY },
  });

  if (!res.ok) throw new Error("Feed fetch failed");

  return await res.json();
}

// Main polling function (runs every 5 seconds)
async function fetchFromESP32() {
  try {
    const distanceData = await fetchFeed("distance");
    const percentData = await fetchFeed("fill_percent");
    const sensorData = await fetchFeed("sensor_ok");

    distanceNow = parseInt(distanceData.value);
    const percent = parseInt(percentData.value);
    const sensorOk = parseInt(sensorData.value) === 1;

    lastDataTimestamp = new Date(distanceData.created_at).getTime();

    renderMetrics(percent, sensorOk);
    pushChartPoint(percent);
  } catch (err) {
    console.error("Cloud fetch error:", err);
    updateStatusUI("WARNING");
  }
}

/* ============================================================
      10. MANUAL SORTING
      ============================================================ */

async function handleManualSort(type) {
  lastSorted = type;
  totalSorted++;

  const binMap = {
    plastic: 1,
    paper: 2,
    other: 3,
  };

  try {
    await sendToFeed("waste_type", type);
    await sendToFeed("target_bin", binMap[type]);

    sortLog.unshift({
      type,
      time: nowTime(),
    });

    renderSortLog();
  } catch (err) {
    console.error("Sort command failed:", err);
    updateStatusUI("WARNING");
  }
}

/* ============================================================
      11. INITIALIZATION
      ============================================================ */

// Start polling cloud every 5 seconds
setInterval(fetchFromESP32, 5000);
fetchFromESP32();

// Initial UI state
renderSortLog();
