const STORAGE_KEY = "territori.data.v1";

const STATUS_OPTIONS = [
  { value: "none", label: "Nessuna nota", short: "-" },
  { value: "absent", label: "Assente", short: "A" },
  { value: "refused", label: "Rifiutato", short: "R" },
  { value: "delivered", label: "Consegnato", short: "C" },
  { value: "avoid", label: "Da evitare", short: "E" },
];

const PIONEER_TYPES = [
  { value: "auxiliary", label: "Pioniere Ausiliare" },
  { value: "special", label: "Pioniere Speciale" },
  { value: "regular", label: "Pioniere Regolare" },
];

const state = {
  screen: "auth",
  history: [],
  currentTerritoryId: null,
  currentStreetId: null,
  currentBuildingId: null,
  workingBuilding: null,
  isDirty: false,
  hoursDraft: null,
  hoursDirty: false,
};

let data = loadData();

const screens = {
  auth: document.getElementById("screen-auth"),
  territories: document.getElementById("screen-territories"),
  territory: document.getElementById("screen-territory"),
  street: document.getElementById("screen-street"),
  portone: document.getElementById("screen-portone"),
  hours: document.getElementById("screen-hours"),
};

const topbar = document.getElementById("topbar");
const topbarTitle = document.getElementById("topbarTitle");
const backButton = document.getElementById("backButton");
const tabbar = document.getElementById("tabbar");
const tabButtons = document.querySelectorAll("[data-tab]");
const sheet = document.getElementById("sheet");
const sheetTitle = document.getElementById("sheetTitle");
const sheetBody = document.getElementById("sheetBody");
const toast = document.getElementById("toast");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const authTabs = document.querySelectorAll("[data-auth-tab]");

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { users: [], sessionUserId: null };
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.users) {
      return { users: [], sessionUserId: null };
    }
    return parsed;
  } catch (error) {
    return { users: [], sessionUserId: null };
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function uid() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2200);
}

function openSheet() {
  sheet.classList.add("is-open");
}

function closeSheet() {
  sheet.classList.remove("is-open");
  sheetTitle.textContent = "";
  sheetBody.innerHTML = "";
}

function setActiveScreen(screenName) {
  Object.values(screens).forEach((screen) => screen.classList.remove("is-active"));
  screens[screenName].classList.add("is-active");
}

function updateTopbar() {
  topbar.classList.toggle("is-hidden", state.screen === "auth");

  if (state.screen === "territories") {
    topbarTitle.textContent = "I tuoi territori";
  }
  if (state.screen === "territory") {
    const territory = getCurrentTerritory();
    topbarTitle.textContent = territory ? territory.name : "Territorio";
  }
  if (state.screen === "street") {
    const street = getCurrentStreet();
    topbarTitle.textContent = street ? street.name : "Via";
  }
  if (state.screen === "portone") {
    const building = getCurrentBuilding();
    topbarTitle.textContent = building ? `Portone ${building.civic}` : "Portone";
  }
  if (state.screen === "hours") {
    topbarTitle.textContent = "Ore di servizio";
  }

  backButton.style.visibility = state.history.length ? "visible" : "hidden";
  updateTabbar();
}

function updateTabbar() {
  if (!tabbar) {
    return;
  }
  tabbar.classList.toggle("is-hidden", state.screen === "auth");
  const activeTab = state.screen === "hours" ? "hours" : "territories";
  tabButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === activeTab);
  });
}

function navigate(screen, params = {}) {
  if (state.screen && screen !== state.screen && !params.skipHistory) {
    state.history.push({
      screen: state.screen,
      territoryId: state.currentTerritoryId,
      streetId: state.currentStreetId,
      buildingId: state.currentBuildingId,
    });
  }

  state.screen = screen;
  if (Object.prototype.hasOwnProperty.call(params, "territoryId")) {
    state.currentTerritoryId = params.territoryId;
  }
  if (Object.prototype.hasOwnProperty.call(params, "streetId")) {
    state.currentStreetId = params.streetId;
  }
  if (Object.prototype.hasOwnProperty.call(params, "buildingId")) {
    state.currentBuildingId = params.buildingId;
  }

  updateTopbar();
  renderCurrent();
}

function goBack() {
  if (state.screen === "portone" && state.isDirty) {
    const confirmLeave = window.confirm(
      "Modifiche non salvate. Vuoi uscire senza salvare?"
    );
    if (!confirmLeave) {
      return;
    }
  }

  const prev = state.history.pop();
  if (!prev) {
    return;
  }

  state.screen = prev.screen;
  state.currentTerritoryId = prev.territoryId;
  state.currentStreetId = prev.streetId;
  state.currentBuildingId = prev.buildingId;
  state.workingBuilding = null;
  state.isDirty = false;

  updateTopbar();
  renderCurrent();
}

function renderCurrent() {
  setActiveScreen(state.screen);
  if (state.screen === "auth") {
    renderAuth();
  }
  if (state.screen === "territories") {
    renderTerritories();
  }
  if (state.screen === "territory") {
    renderTerritory();
  }
  if (state.screen === "street") {
    renderStreet();
  }
  if (state.screen === "portone") {
    renderPortone();
  }
  if (state.screen === "hours") {
    renderHours();
  }
}

function renderAuth() {
  const tabs = document.querySelectorAll("[data-auth-tab]");
  tabs.forEach((tab) => tab.classList.remove("is-active"));
  tabs[0].classList.add("is-active");
  loginForm.classList.add("is-active");
  registerForm.classList.remove("is-active");
}

function renderTerritories() {
  const user = getCurrentUser();
  if (!user) {
    navigate("auth", { skipHistory: true });
    return;
  }

  user.territories = user.territories || [];
  const territoryCards = user.territories.map((territory) => {
    territory.streets = territory.streets || [];
    const streetCount = territory.streets.length;
    const buildingCount = territory.streets.reduce(
      (sum, street) => sum + (street.buildings ? street.buildings.length : 0),
      0
    );

    return `
      <div class="list-card" data-territory-id="${territory.id}">
        <div>
          <div class="list-title">${territory.name}</div>
          <div class="list-meta">${formatTerritoryMeta(territory)}</div>
          <div class="list-meta">${streetCount} vie - ${buildingCount} portoni</div>
          <div class="list-meta">${formatUpdatedAt(territory.updatedAt)}</div>
        </div>
        <div class="chip">Apri</div>
      </div>
    `;
  });

  screens.territories.innerHTML = `
    <div class="screen-content">
      <div class="card hero-card">
        <div class="hero-title">Ciao ${user.name}</div>
        <div class="hero-meta">Gestisci i tuoi territori e salva i dati in locale.</div>
        <div class="hero-meta">Ricorda di esportare un file quando hai finito.</div>
        <div class="hero-meta">Oggi: ${formatToday()}</div>
      </div>

      <div class="action-row">
        <button class="btn primary" id="addTerritoryBtn">Nuovo territorio</button>
        <button class="btn ghost" id="exportBtn">Esporta dati</button>
        <label class="btn ghost" id="importLabel">
          Importa
          <input type="file" id="importInput" accept="application/json" hidden />
        </label>
        <button class="btn outline" id="logoutBtn">Esci</button>
      </div>

      <div class="list">
        ${territoryCards.join("") || `<div class="empty">Nessun territorio ancora.</div>`}
      </div>
    </div>
  `;

  screens.territories
    .querySelectorAll("[data-territory-id]")
    .forEach((card) => {
      card.addEventListener("click", () => {
        const territoryId = card.getAttribute("data-territory-id");
        navigate("territory", { territoryId });
      });
    });

  screens.territories
    .querySelector("#addTerritoryBtn")
    .addEventListener("click", () => openTerritoryForm());

  screens.territories
    .querySelector("#exportBtn")
    .addEventListener("click", exportData);

  screens.territories
    .querySelector("#importInput")
    .addEventListener("change", handleImport);

  screens.territories
    .querySelector("#logoutBtn")
    .addEventListener("click", () => {
      data.sessionUserId = null;
      saveData();
      state.history = [];
      state.hoursDraft = null;
      state.hoursDirty = false;
      navigate("auth", { skipHistory: true });
    });
}

function renderTerritory() {
  const user = getCurrentUser();
  const territory = getCurrentTerritory();
  if (!user || !territory) {
    navigate("territories", { skipHistory: true });
    return;
  }

  territory.streets = territory.streets || [];
  const streetCards = territory.streets.map((street) => {
    return `
      <div class="list-card" data-street-id="${street.id}">
        <div>
          <div class="list-title">${street.name}</div>
          <div class="list-meta">${formatStreetRange(street)}</div>
          <div class="list-meta">${street.buildings.length} portoni</div>
        </div>
        <div class="chip">Apri</div>
      </div>
    `;
  });

  screens.territory.innerHTML = `
    <div class="screen-content">
      <div class="card hero-card">
        <div class="hero-title">${territory.name}</div>
        <div class="hero-meta">${formatTerritoryMeta(territory)}</div>
        <div class="hero-meta">${territory.description || "Nessuna descrizione"}</div>
        <div class="hero-meta">${formatUpdatedAt(territory.updatedAt)}</div>
      </div>

      <div class="action-row">
        <button class="btn primary" id="addStreetBtn">Aggiungi via</button>
        <button class="btn ghost" id="editTerritoryBtn">Modifica territorio</button>
        <button class="btn danger" id="deleteTerritoryBtn">Elimina territorio</button>
      </div>

      <div class="list">
        ${streetCards.join("") || `<div class="empty">Nessuna via aggiunta.</div>`}
      </div>
    </div>
  `;

  screens.territory
    .querySelectorAll("[data-street-id]")
    .forEach((card) => {
      card.addEventListener("click", () => {
        const streetId = card.getAttribute("data-street-id");
        navigate("street", { streetId, territoryId: territory.id });
      });
    });

  screens.territory
    .querySelector("#addStreetBtn")
    .addEventListener("click", () => openStreetForm(territory));

  screens.territory
    .querySelector("#editTerritoryBtn")
    .addEventListener("click", () => openTerritoryForm(territory));

  screens.territory
    .querySelector("#deleteTerritoryBtn")
    .addEventListener("click", deleteTerritory);
}

function renderStreet() {
  const territory = getCurrentTerritory();
  const street = getCurrentStreet();
  if (!territory || !street) {
    navigate("territory", { territoryId: state.currentTerritoryId, skipHistory: true });
    return;
  }

  const streetMeta = [formatStreetRange(street), territory.city]
    .filter(Boolean)
    .join(" - ");

  street.buildings = street.buildings || [];
  const buildingCards = street.buildings.map((building) => {
    const summary = summarizeBuilding(building);
    return `
      <div class="list-card" data-building-id="${building.id}">
        <div>
          <div class="list-title">${street.name} ${building.civic}</div>
          <div class="list-meta">${summary}</div>
          <div class="list-meta">${formatUpdatedAt(building.updatedAt)}</div>
        </div>
        <div class="chip">Apri</div>
      </div>
    `;
  });

  screens.street.innerHTML = `
    <div class="screen-content">
      <div class="card hero-card">
        <div class="hero-title">${street.name}</div>
        <div class="hero-meta">${streetMeta}</div>
        <div class="hero-meta">${street.buildings.length} portoni generati</div>
      </div>

      <div class="action-row">
        <button class="btn danger" id="deleteStreetBtn">Elimina via</button>
      </div>

      <div class="list">
        ${buildingCards.join("") || `<div class="empty">Nessun portone disponibile.</div>`}
      </div>
    </div>
  `;

  screens.street
    .querySelectorAll("[data-building-id]")
    .forEach((card) => {
      card.addEventListener("click", () => {
        const buildingId = card.getAttribute("data-building-id");
        openPortone(buildingId);
      });
    });

  screens.street
    .querySelector("#deleteStreetBtn")
    .addEventListener("click", deleteStreet);
}

function renderPortone() {
  const territory = getCurrentTerritory();
  const street = getCurrentStreet();
  const building = state.workingBuilding;
  if (!territory || !street || !building) {
    navigate("street", { streetId: state.currentStreetId, skipHistory: true });
    return;
  }

  const grid = building.cells
    .map((cell, index) => {
      const status = cell.status || "none";
      const label = getStatusShort(status);
      const subtitle = cell.leafletLeft
        ? "Volantino lasciato"
        : "Tocca per segnare";
      return `
        <button class="unit" data-cell-index="${index}" data-status="${status}">
          <div class="unit-code">${label}</div>
          <div class="unit-sub">${subtitle}</div>
        </button>
      `;
    })
    .join("");

  screens.portone.innerHTML = `
    <div class="screen-content">
      <div class="card hero-card">
        <div class="hero-title">${street.name} ${building.civic}</div>
        <div class="hero-meta">${[territory.city, territory.zone]
          .filter(Boolean)
          .join(" - ")}</div>
        <div class="hero-meta">${
          building.updatedAt ? `Ultimo salvataggio: ${formatDate(building.updatedAt)}` : "Nessun salvataggio"
        }</div>
      </div>

      <div class="toolbar">
        <button class="btn ghost" id="addRowBtn">Aggiungi riga</button>
        <button class="btn ghost" id="addColBtn">Aggiungi colonna</button>
        <button class="btn ghost" id="removeRowBtn">Rimuovi riga</button>
        <button class="btn ghost" id="removeColBtn">Rimuovi colonna</button>
      </div>

      <div class="card">
        <div class="grid" style="--cols: ${building.cols}">
          ${grid}
        </div>
      </div>

      <div class="toolbar">
        <button class="btn primary" id="savePortoneBtn">Salva modifiche</button>
        <button class="btn outline" id="discardPortoneBtn">Annulla modifiche</button>
      </div>

      <div class="card legend">
        <div class="legend-row">
          <div class="legend-item"><span class="legend-swatch absent"></span>Assente</div>
          <div class="legend-item"><span class="legend-swatch refused"></span>Rifiutato</div>
          <div class="legend-item"><span class="legend-swatch delivered"></span>Consegnato</div>
          <div class="legend-item"><span class="legend-swatch avoid"></span>Da evitare</div>
        </div>
        <div class="legend-item">Volantino lasciato: indicato nella cella</div>
      </div>
    </div>
  `;

  screens.portone.querySelectorAll("[data-cell-index]").forEach((cell) => {
    cell.addEventListener("click", () => {
      const index = Number(cell.getAttribute("data-cell-index"));
      openCellEditor(index);
    });
  });

  screens.portone.querySelector("#addRowBtn").addEventListener("click", () => {
    addRow();
  });

  screens.portone.querySelector("#addColBtn").addEventListener("click", () => {
    addCol();
  });

  screens.portone.querySelector("#removeRowBtn").addEventListener("click", () => {
    removeRow();
  });

  screens.portone.querySelector("#removeColBtn").addEventListener("click", () => {
    removeCol();
  });

  screens.portone
    .querySelector("#savePortoneBtn")
    .addEventListener("click", savePortone);

  screens.portone
    .querySelector("#discardPortoneBtn")
    .addEventListener("click", discardPortone);
}

function renderHours() {
  const user = getCurrentUser();
  if (!user) {
    navigate("auth", { skipHistory: true });
    return;
  }

  ensureHoursDraft(user);
  const monthCards = state.hoursDraft.map((month) => {
    const tags = [];
    if (month.pioneerType === "auxiliary" && month.supervisorVisit) {
      tags.push("Visita del sorvegliante");
    }

    return `
      <div class="card month-card" data-month-id="${month.id}">
        <div class="month-header">
          <div class="month-title">${month.monthName} ${month.year}</div>
          <div class="month-meta">${getPioneerLabel(month.pioneerType)}</div>
          <div class="month-meta">${formatUpdatedAt(month.updatedAt)}</div>
          ${
            tags.length
              ? `<div class="month-tags">${tags
                  .map((tag) => `<span class="tag">${tag}</span>`)
                  .join("")}</div>`
              : ""
          }
        </div>
        <div class="counter-grid">
          <div class="counter-block">
            <div class="counter-label">Ore</div>
            <div class="counter-controls">
              <button class="counter-btn" data-month-id="${month.id}" data-counter="hours" data-delta="-1">-</button>
              <div class="counter-value">${month.hours || 0}h</div>
              <button class="counter-btn" data-month-id="${month.id}" data-counter="hours" data-delta="1">+</button>
            </div>
          </div>
          <div class="counter-block">
            <div class="counter-label">Minuti</div>
            <div class="counter-controls">
              <button class="counter-btn" data-month-id="${month.id}" data-counter="minutes" data-delta="-1">-</button>
              <div class="counter-value">${month.minutes || 0}m</div>
              <button class="counter-btn" data-month-id="${month.id}" data-counter="minutes" data-delta="1">+</button>
            </div>
          </div>
        </div>
        <div class="month-actions">
          <button class="btn danger" data-delete-month="${month.id}">Elimina mese</button>
        </div>
      </div>
    `;
  });

  screens.hours.innerHTML = `
    <div class="screen-content">
      <div class="card hero-card">
        <div class="hero-title">Ore di servizio</div>
        <div class="hero-meta">Registra le ore mese per mese.</div>
        ${state.hoursDirty ? `<div class="hero-meta">Modifiche non salvate: premi Salva ore.</div>` : ""}
      </div>

      <div class="action-row">
        <button class="btn primary" id="addMonthBtn">Aggiungi mese</button>
        <button class="btn ghost" id="saveHoursBtn">Salva ore</button>
      </div>

      <div class="list">
        ${monthCards.join("") || `<div class="empty">Nessun mese registrato.</div>`}
      </div>
    </div>
  `;

  screens.hours
    .querySelector("#addMonthBtn")
    .addEventListener("click", openMonthForm);

  screens.hours
    .querySelector("#saveHoursBtn")
    .addEventListener("click", saveHours);

  screens.hours.querySelectorAll(".counter-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const monthId = button.dataset.monthId;
      const counter = button.dataset.counter;
      const delta = Number(button.dataset.delta);
      adjustMonthTime(monthId, counter, delta);
    });
  });

  screens.hours.querySelectorAll("[data-delete-month]").forEach((button) => {
    button.addEventListener("click", () => {
      const monthId = button.dataset.deleteMonth;
      deleteMonth(monthId);
    });
  });
}

function getCurrentUser() {
  if (!data.sessionUserId) {
    return null;
  }
  return data.users.find((user) => user.id === data.sessionUserId) || null;
}

function getCurrentTerritory() {
  const user = getCurrentUser();
  if (!user) {
    return null;
  }
  return (user.territories || []).find((t) => t.id === state.currentTerritoryId) || null;
}

function getCurrentStreet() {
  const territory = getCurrentTerritory();
  if (!territory) {
    return null;
  }
  return (territory.streets || []).find((s) => s.id === state.currentStreetId) || null;
}

function getCurrentBuilding() {
  const street = getCurrentStreet();
  if (!street) {
    return null;
  }
  return (street.buildings || []).find((b) => b.id === state.currentBuildingId) || null;
}

function formatTerritoryMeta(territory) {
  const parts = [];
  if (territory.city) {
    parts.push(territory.city);
  }
  if (territory.zone) {
    parts.push(territory.zone);
  }
  return parts.join(" - ") || "Nessuna zona definita";
}

function formatStreetRange(street) {
  return `${street.from} - ${street.to}`;
}

function summarizeBuilding(building) {
  const counts = { absent: 0, refused: 0, delivered: 0, avoid: 0 };
  building.cells.forEach((cell) => {
    if (counts[cell.status] !== undefined) {
      counts[cell.status] += 1;
    }
  });

  const parts = [];
  if (counts.delivered) {
    parts.push(`Consegnato ${counts.delivered}`);
  }
  if (counts.refused) {
    parts.push(`Rifiutato ${counts.refused}`);
  }
  if (counts.absent) {
    parts.push(`Assente ${counts.absent}`);
  }
  if (counts.avoid) {
    parts.push(`Evita ${counts.avoid}`);
  }

  return parts.join(" - ") || "Nessuna nota";
}

function getStatusShort(status) {
  const match = STATUS_OPTIONS.find((option) => option.value === status);
  return match ? match.short : "-";
}

function getPioneerLabel(value) {
  const match = PIONEER_TYPES.find((type) => type.value === value);
  return match ? match.label : "Pioniere";
}

function ensureHoursDraft(user) {
  if (!state.hoursDraft) {
    user.hours = user.hours || [];
    state.hoursDraft = JSON.parse(JSON.stringify(user.hours));
  }
}

function saveHours() {
  const user = getCurrentUser();
  if (!user) {
    return;
  }
  ensureHoursDraft(user);

  if (!state.hoursDirty) {
    showToast("Nessuna modifica da salvare");
    return;
  }

  const now = new Date().toISOString();
  const saved = state.hoursDraft.map((month) => {
    const cleaned = { ...month };
    if (cleaned.isDirty || !cleaned.updatedAt) {
      cleaned.updatedAt = now;
    }
    delete cleaned.isDirty;
    return cleaned;
  });

  user.hours = saved;
  saveData();
  state.hoursDraft = JSON.parse(JSON.stringify(user.hours));
  state.hoursDirty = false;
  renderHours();
  showToast("Ore salvate");
}

function deleteMonth(monthId) {
  const user = getCurrentUser();
  if (!user) {
    return;
  }
  ensureHoursDraft(user);
  const month = state.hoursDraft.find((item) => item.id === monthId);
  if (!month) {
    return;
  }

  const confirmDelete = window.confirm(
    `Eliminare il mese \"${month.monthName} ${month.year}\"?`
  );
  if (!confirmDelete) {
    return;
  }

  state.hoursDraft = state.hoursDraft.filter((item) => item.id !== monthId);
  state.hoursDirty = true;
  renderHours();
  showToast("Mese rimosso");
}

function touchTerritory(territory) {
  if (!territory) {
    return;
  }
  territory.updatedAt = new Date().toISOString();
}

function buildNumbers(from, to, mode) {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  let parity = mode;
  if (parity === "auto") {
    parity = start % 2 === 0 ? "even" : "odd";
  }

  const numbers = [];
  if (parity === "all") {
    for (let i = start; i <= end; i += 1) {
      numbers.push(i);
    }
    return numbers;
  }

  let current = start;
  if (parity === "even" && current % 2 !== 0) {
    current += 1;
  }
  if (parity === "odd" && current % 2 === 0) {
    current += 1;
  }

  for (let i = current; i <= end; i += 2) {
    numbers.push(i);
  }
  return numbers;
}

function createCells(rows, cols) {
  const cells = [];
  for (let i = 0; i < rows * cols; i += 1) {
    cells.push({ status: "none", leafletLeft: false });
  }
  return cells;
}

function openTerritoryForm(territory = null) {
  const isEdit = Boolean(territory);

  sheetTitle.textContent = isEdit ? "Modifica territorio" : "Nuovo territorio";
  sheetBody.innerHTML = `
    <form class="form is-active" id="territoryForm">
      <div class="field">
        <label>Nome territorio</label>
        <input name="name" required value="${territory ? territory.name : ""}" />
      </div>
      <div class="field">
        <label>Citta</label>
        <input name="city" value="${territory ? territory.city || "" : ""}" />
      </div>
      <div class="field">
        <label>Zona</label>
        <input name="zone" value="${territory ? territory.zone || "" : ""}" />
      </div>
      <div class="field">
        <label>Descrizione</label>
        <textarea name="description">${territory ? territory.description || "" : ""}</textarea>
      </div>
      <div class="sheet-actions">
        <button type="button" class="btn ghost" data-sheet-close>Annulla</button>
        <button type="submit" class="btn primary">Salva</button>
      </div>
    </form>
  `;

  const form = sheetBody.querySelector("#territoryForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = {
      name: formData.get("name").trim(),
      city: formData.get("city").trim(),
      zone: formData.get("zone").trim(),
      description: formData.get("description").trim(),
    };

    if (!payload.name) {
      showToast("Inserisci il nome del territorio");
      return;
    }

    const user = getCurrentUser();
    if (!user) {
      return;
    }

    if (isEdit) {
      territory.name = payload.name;
      territory.city = payload.city;
      territory.zone = payload.zone;
      territory.description = payload.description;
      touchTerritory(territory);
    } else {
      const now = new Date().toISOString();
      user.territories = user.territories || [];
      user.territories.push({
        id: uid(),
        name: payload.name,
        city: payload.city,
        zone: payload.zone,
        description: payload.description,
        streets: [],
        updatedAt: now,
      });
    }

    saveData();
    closeSheet();
    renderCurrent();
    showToast("Territorio salvato");
  });

  openSheet();
}

function openStreetForm(territory) {
  sheetTitle.textContent = "Nuova via";
  sheetBody.innerHTML = `
    <form class="form is-active" id="streetForm">
      <div class="field">
        <label>Nome via, piazza, strada</label>
        <input name="name" required />
      </div>
      <div class="field">
        <label>Da civico</label>
        <input name="from" type="number" min="1" required />
      </div>
      <div class="field">
        <label>A civico</label>
        <input name="to" type="number" min="1" required />
      </div>
      <div class="field">
        <label>Numeri civici</label>
        <select name="parity">
          <option value="auto">Automatico (come numero iniziale)</option>
          <option value="odd">Solo dispari</option>
          <option value="even">Solo pari</option>
          <option value="all">Tutti</option>
        </select>
      </div>
      <div class="sheet-actions">
        <button type="button" class="btn ghost" data-sheet-close>Annulla</button>
        <button type="submit" class="btn primary">Crea via</button>
      </div>
    </form>
  `;

  const form = sheetBody.querySelector("#streetForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const name = formData.get("name").trim();
    const from = Number(formData.get("from"));
    const to = Number(formData.get("to"));
    const parity = formData.get("parity");

    if (!name || !from || !to) {
      showToast("Completa tutti i campi richiesti");
      return;
    }

    const numbers = buildNumbers(from, to, parity);
    if (!numbers.length) {
      showToast("Nessun civico nel range");
      return;
    }

    const buildings = numbers.map((number) => ({
      id: uid(),
      civic: number,
      rows: 4,
      cols: 2,
      cells: createCells(4, 2),
      updatedAt: null,
    }));

    territory.streets = territory.streets || [];
    territory.streets.push({
      id: uid(),
      name,
      from,
      to,
      parity,
      buildings,
    });

    touchTerritory(territory);
    saveData();
    closeSheet();
    renderCurrent();
    showToast("Via creata");
  });

  openSheet();
}

function openMonthForm() {
  sheetTitle.textContent = "Nuovo mese";
  sheetBody.innerHTML = `
    <form class="form is-active" id="monthForm">
      <div class="field">
        <label>Mese</label>
        <input name="month" placeholder="Es. Marzo" required />
      </div>
      <div class="field">
        <label>Anno</label>
        <input name="year" type="number" min="2000" max="2100" required />
      </div>
      <div class="field">
        <label>Tipo di pioniere</label>
        <div class="radio-grid">
          ${PIONEER_TYPES.map(
            (type, index) => `
              <label class="radio-item">
                <input type="radio" name="pioneerType" value="${type.value}" ${
                  index === 0 ? "checked" : ""
                } />
                <span>${type.label}</span>
              </label>
            `
          ).join("")}
        </div>
      </div>
      <label class="toggle" id="supervisorToggle">
        <input type="checkbox" name="supervisorVisit" />
        <span>Visita del sorvegliante</span>
      </label>
      <div class="sheet-actions">
        <button type="button" class="btn ghost" data-sheet-close>Annulla</button>
        <button type="submit" class="btn primary">Salva mese</button>
      </div>
    </form>
  `;

  const form = sheetBody.querySelector("#monthForm");
  const supervisorToggle = form.querySelector("input[name='supervisorVisit']");

  const syncSupervisor = () => {
    const type = form.elements.pioneerType.value;
    const isAuxiliary = type === "auxiliary";
    supervisorToggle.disabled = !isAuxiliary;
    if (!isAuxiliary) {
      supervisorToggle.checked = false;
    }
  };

  syncSupervisor();
  form.querySelectorAll("input[name='pioneerType']").forEach((radio) => {
    radio.addEventListener("change", syncSupervisor);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const monthName = formData.get("month").trim();
    const year = Number(formData.get("year"));
    const pioneerType = formData.get("pioneerType");
    const supervisorVisit = Boolean(formData.get("supervisorVisit"));

    if (!monthName || !year) {
      showToast("Completa i campi richiesti");
      return;
    }

    const user = getCurrentUser();
    if (!user) {
      return;
    }

    ensureHoursDraft(user);
    state.hoursDraft.push({
      id: uid(),
      monthName,
      year,
      pioneerType,
      supervisorVisit,
      hours: 0,
      minutes: 0,
      updatedAt: null,
      isDirty: true,
    });

    state.hoursDirty = true;
    closeSheet();
    renderHours();
    showToast("Mese aggiunto");
  });

  openSheet();
}

function adjustMonthTime(monthId, counter, delta) {
  const user = getCurrentUser();
  if (!user) {
    return;
  }
  ensureHoursDraft(user);
  const month = state.hoursDraft.find((item) => item.id === monthId);
  if (!month) {
    return;
  }

  const currentHours = Number(month.hours) || 0;
  const currentMinutes = Number(month.minutes) || 0;
  let totalMinutes = currentHours * 60 + currentMinutes;

  if (counter === "hours") {
    totalMinutes += delta * 60;
  } else {
    totalMinutes += delta;
  }

  if (totalMinutes < 0) {
    totalMinutes = 0;
  }

  month.hours = Math.floor(totalMinutes / 60);
  month.minutes = totalMinutes % 60;
  month.isDirty = true;
  state.hoursDirty = true;
  renderHours();
}

function deleteTerritory() {
  const user = getCurrentUser();
  const territory = getCurrentTerritory();
  if (!user || !territory) {
    return;
  }

  const confirmDelete = window.confirm(
    `Eliminare il territorio \"${territory.name}\"? Verranno cancellate anche tutte le vie e i portoni.`
  );
  if (!confirmDelete) {
    return;
  }

  user.territories = (user.territories || []).filter(
    (item) => item.id !== territory.id
  );
  saveData();
  state.history = [];
  state.currentTerritoryId = null;
  state.currentStreetId = null;
  state.currentBuildingId = null;
  state.workingBuilding = null;
  state.isDirty = false;
  navigate("territories", {
    skipHistory: true,
    territoryId: null,
    streetId: null,
    buildingId: null,
  });
  showToast("Territorio eliminato");
}

function deleteStreet() {
  const territory = getCurrentTerritory();
  const street = getCurrentStreet();
  if (!territory || !street) {
    return;
  }

  const confirmDelete = window.confirm(
    `Eliminare la via \"${street.name}\"? Verranno cancellati ${street.buildings.length} portoni.`
  );
  if (!confirmDelete) {
    return;
  }

  territory.streets = (territory.streets || []).filter(
    (item) => item.id !== street.id
  );
  touchTerritory(territory);
  saveData();
  state.currentStreetId = null;
  state.currentBuildingId = null;
  state.workingBuilding = null;
  state.isDirty = false;
  navigate("territory", { territoryId: territory.id, skipHistory: true });
  showToast("Via eliminata");
}

function openPortone(buildingId) {
  const street = getCurrentStreet();
  if (!street) {
    return;
  }
  const building = street.buildings.find((item) => item.id === buildingId);
  if (!building) {
    return;
  }
  state.currentBuildingId = buildingId;
  state.workingBuilding = JSON.parse(JSON.stringify(building));
  state.isDirty = false;
  navigate("portone", { buildingId });
}

function openCellEditor(cellIndex) {
  const building = state.workingBuilding;
  const cell = building.cells[cellIndex];

  sheetTitle.textContent = `Interno ${cellIndex + 1}`;
  sheetBody.innerHTML = `
    <form class="form is-active" id="cellForm">
      <div class="radio-grid">
        ${STATUS_OPTIONS.map(
          (option) => `
            <label class="radio-item">
              <input type="radio" name="status" value="${option.value}" />
              <span>${option.label}</span>
            </label>
          `
        ).join("")}
      </div>
      <label class="toggle">
        <input type="checkbox" id="leafletToggle" />
        <span>Volantino lasciato da assente</span>
      </label>
      <div class="sheet-actions">
        <button type="button" class="btn ghost" data-sheet-close>Annulla</button>
        <button type="submit" class="btn primary">Applica</button>
      </div>
    </form>
  `;

  const form = sheetBody.querySelector("#cellForm");
  const radios = form.querySelectorAll("input[name='status']");
  const leafletToggle = form.querySelector("#leafletToggle");

  radios.forEach((radio) => {
    if (radio.value === (cell.status || "none")) {
      radio.checked = true;
    }
  });
  leafletToggle.checked = Boolean(cell.leafletLeft);

  const syncLeaflet = () => {
    const status = form.elements.status.value;
    if (status !== "absent") {
      leafletToggle.checked = false;
      leafletToggle.disabled = true;
    } else {
      leafletToggle.disabled = false;
    }
  };

  syncLeaflet();
  radios.forEach((radio) => radio.addEventListener("change", syncLeaflet));

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    cell.status = form.elements.status.value;
    cell.leafletLeft = leafletToggle.checked;
    state.isDirty = true;
    closeSheet();
    renderPortone();
  });

  openSheet();
}

function addRow() {
  const building = state.workingBuilding;
  building.rows += 1;
  for (let i = 0; i < building.cols; i += 1) {
    building.cells.push({ status: "none", leafletLeft: false });
  }
  state.isDirty = true;
  renderPortone();
}

function addCol() {
  const building = state.workingBuilding;
  const newCells = [];
  for (let row = 0; row < building.rows; row += 1) {
    for (let col = 0; col < building.cols; col += 1) {
      newCells.push(building.cells[row * building.cols + col]);
    }
    newCells.push({ status: "none", leafletLeft: false });
  }
  building.cols += 1;
  building.cells = newCells;
  state.isDirty = true;
  renderPortone();
}

function removeRow() {
  const building = state.workingBuilding;
  if (building.rows <= 1) {
    showToast("Serve almeno una riga");
    return;
  }
  building.rows -= 1;
  building.cells = building.cells.slice(0, building.rows * building.cols);
  state.isDirty = true;
  renderPortone();
}

function removeCol() {
  const building = state.workingBuilding;
  if (building.cols <= 1) {
    showToast("Serve almeno una colonna");
    return;
  }
  const oldCols = building.cols;
  const newCols = oldCols - 1;
  const newCells = [];
  for (let row = 0; row < building.rows; row += 1) {
    for (let col = 0; col < newCols; col += 1) {
      newCells.push(building.cells[row * oldCols + col]);
    }
  }
  building.cols = newCols;
  building.cells = newCells;
  state.isDirty = true;
  renderPortone();
}

function savePortone() {
  const street = getCurrentStreet();
  if (!street) {
    return;
  }
  const territory = getCurrentTerritory();
  const index = street.buildings.findIndex(
    (item) => item.id === state.currentBuildingId
  );
  if (index === -1) {
    return;
  }
  state.workingBuilding.updatedAt = new Date().toISOString();
  street.buildings[index] = state.workingBuilding;
  if (territory) {
    touchTerritory(territory);
  }
  saveData();
  state.isDirty = false;
  showToast("Salvato");
  renderPortone();
}

function discardPortone() {
  const confirmDiscard = window.confirm("Vuoi annullare le modifiche?");
  if (!confirmDiscard) {
    return;
  }
  const building = getCurrentBuilding();
  if (!building) {
    return;
  }
  state.workingBuilding = JSON.parse(JSON.stringify(building));
  state.isDirty = false;
  renderPortone();
}

function exportData() {
  const filename = `territori-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Backup esportato");
}

function handleImport(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported.users) {
        throw new Error("Formato non valido");
      }
      const confirmImport = window.confirm(
        "Importare questo file sovrascrivera i dati attuali. Continuare?"
      );
      if (!confirmImport) {
        return;
      }
      data = imported;
      saveData();
      state.history = [];
      navigate("territories", { skipHistory: true });
      showToast("Dati importati");
    } catch (error) {
      showToast("File non valido");
    }
  };
  reader.readAsText(file);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatUpdatedAt(value) {
  if (!value) {
    return "Ultima modifica: mai";
  }
  const formatted = formatDate(value);
  return formatted ? `Ultima modifica: ${formatted}` : "Ultima modifica: mai";
}

function formatToday() {
  const today = new Date();
  return today.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function setupAuth() {
  authTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      authTabs.forEach((button) => button.classList.remove("is-active"));
      tab.classList.add("is-active");
      if (tab.dataset.authTab === "login") {
        loginForm.classList.add("is-active");
        registerForm.classList.remove("is-active");
      } else {
        loginForm.classList.remove("is-active");
        registerForm.classList.add("is-active");
      }
    });
  });

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const surname = formData.get("surname").trim();
    const password = formData.get("password").trim();

    const user = data.users.find(
      (item) =>
        item.surname.toLowerCase() === surname.toLowerCase() &&
        item.password === password
    );

    if (!user) {
      showToast("Credenziali non valide");
      return;
    }

    data.sessionUserId = user.id;
    saveData();
    state.history = [];
    state.hoursDraft = null;
    state.hoursDirty = false;
    navigate("territories", { skipHistory: true });
  });

  registerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(registerForm);
    const name = formData.get("name").trim();
    const surname = formData.get("surname").trim();
    const password = formData.get("password").trim();

    if (!name || !surname || !password) {
      showToast("Completa tutti i campi");
      return;
    }

    const existing = data.users.find(
      (item) => item.surname.toLowerCase() === surname.toLowerCase()
    );
    if (existing) {
      showToast("Utente gia registrato");
      return;
    }

    const newUser = {
      id: uid(),
      name,
      surname,
      password,
      territories: [],
      hours: [],
    };

    data.users.push(newUser);
    data.sessionUserId = newUser.id;
    saveData();
    state.history = [];
    state.hoursDraft = null;
    state.hoursDirty = false;
    navigate("territories", { skipHistory: true });
  });
}

function switchTab(tab) {
  if (state.screen === "portone" && state.isDirty) {
    const confirmLeave = window.confirm(
      "Modifiche non salvate. Vuoi uscire senza salvare?"
    );
    if (!confirmLeave) {
      return;
    }
  }
  if (state.screen === "hours" && state.hoursDirty) {
    const confirmLeave = window.confirm(
      "Ore non salvate. Vuoi uscire senza salvare?"
    );
    if (!confirmLeave) {
      return;
    }
    state.hoursDraft = null;
    state.hoursDirty = false;
  }

  state.history = [];
  state.currentTerritoryId = null;
  state.currentStreetId = null;
  state.currentBuildingId = null;
  state.workingBuilding = null;
  state.isDirty = false;

  if (tab === "hours") {
    navigate("hours", { skipHistory: true });
  } else {
    navigate("territories", { skipHistory: true });
  }
}

function setupTabs() {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      switchTab(button.dataset.tab);
    });
  });
}

backButton.addEventListener("click", goBack);

document.addEventListener("click", (event) => {
  if (event.target.matches("[data-sheet-close]")) {
    closeSheet();
  }
  if (event.target.classList.contains("sheet-backdrop")) {
    closeSheet();
  }
});

setupAuth();
setupTabs();

if (data.sessionUserId) {
  navigate("territories", { skipHistory: true });
} else {
  navigate("auth", { skipHistory: true });
}
