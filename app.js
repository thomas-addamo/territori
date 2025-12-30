const STORAGE_KEY = "territori.data.v1";

const STATUS_OPTIONS = [
  { value: "none", label: "Nessuna nota", short: "-" },
  { value: "absent", label: "Assente", short: "A" },
  { value: "refused", label: "Rifiutato", short: "R" },
  { value: "delivered", label: "Consegnato", short: "C" },
  { value: "avoid", label: "Da evitare", short: "E" },
];

const state = {
  screen: "auth",
  history: [],
  currentTerritoryId: null,
  currentStreetId: null,
  currentBuildingId: null,
  workingBuilding: null,
  isDirty: false,
};

let data = loadData();

const screens = {
  auth: document.getElementById("screen-auth"),
  territories: document.getElementById("screen-territories"),
  territory: document.getElementById("screen-territory"),
  street: document.getElementById("screen-street"),
  portone: document.getElementById("screen-portone"),
};

const topbar = document.getElementById("topbar");
const topbarTitle = document.getElementById("topbarTitle");
const backButton = document.getElementById("backButton");
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

  backButton.style.visibility = state.history.length ? "visible" : "hidden";
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
    const streetCount = territory.streets.length;
    const buildingCount = territory.streets.reduce(
      (sum, street) => sum + street.buildings.length,
      0
    );

    return `
      <div class="list-card" data-territory-id="${territory.id}">
        <div>
          <div class="list-title">${territory.name}</div>
          <div class="list-meta">${formatTerritoryMeta(territory)}</div>
          <div class="list-meta">${streetCount} vie - ${buildingCount} portoni</div>
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

  screens.portone
    .querySelector("#savePortoneBtn")
    .addEventListener("click", savePortone);

  screens.portone
    .querySelector("#discardPortoneBtn")
    .addEventListener("click", discardPortone);
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
    } else {
      user.territories = user.territories || [];
      user.territories.push({
        id: uid(),
        name: payload.name,
        city: payload.city,
        zone: payload.zone,
        description: payload.description,
        streets: [],
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

    saveData();
    closeSheet();
    renderCurrent();
    showToast("Via creata");
  });

  openSheet();
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

function savePortone() {
  const street = getCurrentStreet();
  if (!street) {
    return;
  }
  const index = street.buildings.findIndex(
    (item) => item.id === state.currentBuildingId
  );
  if (index === -1) {
    return;
  }
  state.workingBuilding.updatedAt = new Date().toISOString();
  street.buildings[index] = state.workingBuilding;
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
    };

    data.users.push(newUser);
    data.sessionUserId = newUser.id;
    saveData();
    state.history = [];
    navigate("territories", { skipHistory: true });
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

if (data.sessionUserId) {
  navigate("territories", { skipHistory: true });
} else {
  navigate("auth", { skipHistory: true });
}
