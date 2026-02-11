const bin = document.querySelector(".bin");
const message = document.getElementById("binMessage");

const modal = document.getElementById("sortModal");
const openBtn = document.getElementById("openModal");
const closeBtn = document.getElementById("closeModal");

openBtn.onclick = () => (modal.style.display = "block");
closeBtn.onclick = () => (modal.style.display = "none");

window.onclick = (e) => {
  if (e.target === modal) modal.style.display = "none";
};

// Sorting LOG SCRIPTS

function addSortLog(type) {
  const log = document.getElementById("sortLog");

  const item = document.createElement("li");
  item.className = "log-item";

  const now = new Date().toLocaleTimeString();

  item.innerHTML = `
        <span class="log-type ${type}">${type.toUpperCase()}</span>
        <span class="log-time">${now}</span>
      `;

  log.prepend(item);

  document.getElementById("lastSorted").innerText = type;
}

function sortWaste(type) {
  console.log("Selected:", type);

  document.getElementById("target-bin").innerText = type;
  openBin();

  modal.style.display = "none";

  addSortLog(type);
}

function openBin() {
  bin.classList.add("open");
  message.textContent = "🗑️ Sorting trash...";

  setTimeout(() => {
    bin.classList.remove("open");
    message.textContent = "✅ Trash sorted!";
  }, 1500);
}

let lastDistanceLog = 0;

function updateDistance(value) {
  document.getElementById("binDistance").innerText = value + " cm";

  const now = Date.now();
  if (now - lastDistanceLog < 20000) return;

  lastDistanceLog = now;

  const log = document.getElementById("distanceLog");
  const item = document.createElement("li");

  item.textContent = `${new Date().toLocaleTimeString()} → ${value} cm`;
  log.prepend(item);

  if (log.children.length > 8) {
    log.removeChild(log.lastChild);
  }
}
