// =================== CONFIG (match your bin calibration) ===================
const EMPTY_DIST_CM = 60; // distance when bin is empty
const FULL_DIST_CM = 10; // distance when bin is full
const FULL_THRESHOLD_PERCENT = 80; // alert threshold
const DISTANCE_LOG_INTERVAL_MS = 20000; // 20 seconds

// =================== STATE ===================
let totalSorted = 0;
let lastSorted = "None";

let distanceNow = 20; // mock initial
let distanceLog = [];
let sortLog = [];
let currentFilter = "all";

// =================== DOM ===================
const elDistanceCm = document.getElementById("distanceCm");
const elDistanceCm2 = document.getElementById("distanceCm2");
const elFillPercent = document.getElementById("fillPercent");
const elBarFill = document.getElementById("barFill");
const elSystemStatusText = document.getElementById("systemStatusText");
const elSystemStatusSub = document.getElementById("systemStatusSub");
const elStatusBadge = document.getElementById("statusBadge");
const elLastSorted = document.getElementById("lastSorted");
const elTotalSorted = document.getElementById("totalSorted");
const elDistanceLog = document.getElementById("distanceLog");
const elSortLog = document.getElementById("sortLog");

const modal = document.getElementById("sortModal");
document.getElementById("openSort").onclick = () =>
  (modal.style.display = "flex");
document.getElementById("closeSort").onclick = () =>
  (modal.style.display = "none");
modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.style.display = "none";
});

document.querySelectorAll(".opt").forEach((btn) => {
  btn.addEventListener("click", () => {
    const type = btn.dataset.type;
    handleManualSort(type);
    modal.style.display = "none";
  });
});

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

// =================== HELPERS ===================
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function distanceToPercent(distanceCm) {
  // 0% when >= empty distance, 100% when <= full distance
  if (distanceCm >= EMPTY_DIST_CM) return 0;
  if (distanceCm <= FULL_DIST_CM) return 100;
  const pct =
    ((EMPTY_DIST_CM - distanceCm) / (EMPTY_DIST_CM - FULL_DIST_CM)) * 100;
  return clamp(Math.round(pct), 0, 100);
}

function statusFromPercent(pct) {
  if (pct >= FULL_THRESHOLD_PERCENT) return "FULL";
  if (pct >= 60) return "WARNING";
  return "OPERATIONAL";
}

function colorizeStatus(status) {
  // update badge + top status text (minimal but clear)
  elStatusBadge.textContent = status;

  if (status === "FULL") {
    elStatusBadge.style.background = "var(--danger-2)";
    elStatusBadge.style.borderColor = "#ffd0d0";
    elStatusBadge.style.color = "var(--danger)";
    elSystemStatusText.textContent = "Full";
    elSystemStatusSub.textContent = "Bin capacity exceeded threshold";
  } else if (status === "WARNING") {
    elStatusBadge.style.background = "var(--warn-2)";
    elStatusBadge.style.borderColor = "#ffe8b0";
    elStatusBadge.style.color = "#b45309";
    elSystemStatusText.textContent = "Warning";
    elSystemStatusSub.textContent = "Bin approaching full capacity";
  } else {
    elStatusBadge.style.background = "var(--green-2)";
    elStatusBadge.style.borderColor = "#d7efe6";
    elStatusBadge.style.color = "#1f5f48";
    elSystemStatusText.textContent = "Operational";
    elSystemStatusSub.textContent = "Bin operating normally";
  }
}

function nowTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// =================== RENDER ===================
function renderMetrics() {
  elDistanceCm.textContent = distanceNow;
  elDistanceCm2.textContent = distanceNow;

  const pct = distanceToPercent(distanceNow);
  elFillPercent.textContent = pct;
  elBarFill.style.width = `${pct}%`;

  const status = statusFromPercent(pct);
  colorizeStatus(status);

  elLastSorted.textContent = lastSorted;
  elTotalSorted.textContent = totalSorted;
}

function renderDistanceLog() {
  elDistanceLog.innerHTML = "";
  distanceLog.slice(0, 10).forEach((entry) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="li-left">
        <span class="tag">${entry.percent}%</span>
        <span>${entry.distance} cm</span>
      </div>
      <span class="time">${entry.time}</span>
    `;
    elDistanceLog.appendChild(li);
  });
}

function renderSortLog() {
  elSortLog.innerHTML = "";
  const filtered = sortLog.filter((e) =>
    currentFilter === "all" ? true : e.type === currentFilter,
  );

  if (filtered.length === 0) {
    const li = document.createElement("li");
    li.innerHTML = `<div class="li-left"><span class="tag">—</span><span>No sorting activity yet</span></div><span class="time">${nowTime()}</span>`;
    elSortLog.appendChild(li);
    return;
  }

  filtered.slice(0, 12).forEach((entry) => {
    const li = document.createElement("li");
    const label = entry.type.toUpperCase();
    const tagColor =
      entry.type === "plastic"
        ? "background:#e7f3ff;border-color:#d7e9ff"
        : entry.type === "paper"
          ? "background:#fff4da;border-color:#ffe8b0"
          : "background:#e7f7f1;border-color:#cdeee2";

    li.innerHTML = `
      <div class="li-left">
        <span class="tag" style="${tagColor}">${label}</span>
        <span>Sorted (manual)</span>
      </div>
      <span class="time">${entry.time}</span>
    `;
    elSortLog.appendChild(li);
  });
}

// =================== CHART ===================
const ctx = document.getElementById("distanceChart");
const chart = new Chart(ctx, {
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
        pointRadius: 2,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: { min: 0, max: 100, ticks: { stepSize: 20 } },
    },
  },
});

function pushChartPoint(percent) {
  const t = nowTime();
  chart.data.labels.push(t);
  chart.data.datasets[0].data.push(percent);

  if (chart.data.labels.length > 12) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
  chart.update();
}

// Make chart area height stable
document.querySelector(".chart-wrap").style.height = "220px";

// =================== ACTIONS ===================
function handleManualSort(type) {
  lastSorted = type;
  totalSorted += 1;

  sortLog.unshift({ type, time: nowTime() });
  renderMetrics();
  renderSortLog();

  // Later: send to ESP32
  // sendSortCommand(type);
}

/**
 * Called every 20 seconds (matches your professor guideline).
 * Later this becomes: distanceNow = await fetchDistanceFromESP32();
 */
function sampleDistance() {
  // MOCK behavior (replace later):
  // Simulate random change in distance
  const delta = Math.floor(Math.random() * 7) - 3; // -3..+3
  distanceNow = clamp(distanceNow + delta, 5, 80);

  const percent = distanceToPercent(distanceNow);
  distanceLog.unshift({ distance: distanceNow, percent, time: nowTime() });

  renderMetrics();
  renderDistanceLog();
  pushChartPoint(percent);

  if (distanceLog.length > 20) distanceLog.pop();
}

// =================== ESP32 HOOKS (PLACEHOLDERS) ===================
// When ready, implement these:
// async function fetchDistanceFromESP32(){ ... }
// async function sendSortCommand(type){ ... }

// =================== INIT ===================
renderMetrics();
renderDistanceLog();
renderSortLog();
sampleDistance(); // first sample immediately
setInterval(sampleDistance, DISTANCE_LOG_INTERVAL_MS);
