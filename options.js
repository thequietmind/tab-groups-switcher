"use strict";

const api = globalThis.browser;
const storageKey = "rememberedGroups";
const settingsKey = "settings";
const defaultSettings = {
  closeOtherTabGroupsWhenSwitching: false
};
const colorOptions = new Set([
  "grey",
  "blue",
  "cyan",
  "green",
  "orange",
  "pink",
  "purple",
  "red",
  "yellow"
]);
const colorMap = {
  blue: "#45a1ff",
  cyan: "#00c8d7",
  gray: "#9aa0a6",
  grey: "#9aa0a6",
  green: "#12bc00",
  orange: "#ff9400",
  pink: "#ff4aa2",
  purple: "#ab71ff",
  red: "#ff4f5e",
  yellow: "#d7b600"
};
const state = {
  groups: [],
  draggedId: null,
  settings: { ...defaultSettings }
};

const elements = {
  list: document.querySelector("#groups-list"),
  status: document.querySelector("#status"),
  closeOtherGroups: document.querySelector("#close-other-groups")
};

function setStatus(message) {
  elements.status.textContent = message;
}

function normalizeGroup(group, index) {
  const now = Date.now();
  const urls = Array.isArray(group.urls) ? group.urls.filter(Boolean) : [];
  const titles = Array.isArray(group.titles) ? group.titles : [];
  const color = colorOptions.has(group.color) ? group.color : "grey";

  return {
    id: String(group.id || `remembered-${now}-${index}`),
    name: String(group.name || "Untitled group"),
    color,
    urls,
    titles: urls.map((_, urlIndex) => String(titles[urlIndex] ?? "")),
    order: Number.isFinite(group.order) ? group.order : index,
    createdAt: Number.isFinite(group.createdAt) ? group.createdAt : now,
    updatedAt: Number.isFinite(group.updatedAt) ? group.updatedAt : now,
    source: "auto-tracked"
  };
}

async function loadOptions() {
  const result = await api.storage.local.get({
    [storageKey]: [],
    [settingsKey]: defaultSettings
  });
  const groups = Array.isArray(result[storageKey]) ? result[storageKey] : [];
  state.settings = {
    ...defaultSettings,
    ...(result[settingsKey] ?? {})
  };
  state.groups = groups
    .map(normalizeGroup)
    .sort((first, second) => first.order - second.order)
    .map((group, index) => ({ ...group, order: index }));
  renderSettings();
  renderGroups();
}

function renderSettings() {
  elements.closeOtherGroups.checked =
    state.settings.closeOtherTabGroupsWhenSwitching === true;
}

async function saveSettings(message = "Settings saved.") {
  await api.storage.local.set({ [settingsKey]: state.settings });
  setStatus(message);
}

async function saveGroups(message = "Order saved.") {
  state.groups = state.groups.map((group, index) => ({
    ...group,
    order: index,
    updatedAt: Date.now()
  }));
  await api.storage.local.set({ [storageKey]: state.groups });
  setStatus(message);
}

function clearList() {
  elements.list.replaceChildren();
}

function renderGroups() {
  clearList();

  if (state.groups.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No remembered groups yet.";
    elements.list.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const group of state.groups) {
    fragment.append(createGroupRow(group));
  }

  elements.list.append(fragment);
}

function createGroupRow(group) {
  const row = document.createElement("article");
  row.className = "group-row";
  row.draggable = true;
  row.dataset.id = group.id;

  const handle = document.createElement("span");
  handle.className = "drag-handle";
  handle.textContent = "⋮⋮";
  handle.setAttribute("aria-hidden", "true");

  const dot = document.createElement("span");
  dot.className = "color-dot";
  dot.style.setProperty("--indicator", colorMap[group.color] ?? colorMap.grey);

  const name = document.createElement("span");
  name.className = "group-name";
  name.textContent = group.name;

  row.addEventListener("dragstart", () => {
    state.draggedId = group.id;
    row.classList.add("dragging");
  });
  row.addEventListener("dragend", () => {
    state.draggedId = null;
    row.classList.remove("dragging");
  });
  row.addEventListener("dragover", (event) => event.preventDefault());
  row.addEventListener("drop", async (event) => {
    event.preventDefault();

    if (!state.draggedId || state.draggedId === group.id) {
      return;
    }

    const draggedIndex = state.groups.findIndex((item) => item.id === state.draggedId);
    const targetIndex = state.groups.findIndex((item) => item.id === group.id);

    if (draggedIndex === -1 || targetIndex === -1) {
      return;
    }

    const [draggedGroup] = state.groups.splice(draggedIndex, 1);
    state.groups.splice(targetIndex, 0, draggedGroup);
    await saveGroups();
    renderGroups();
  });

  row.append(handle, dot, name);
  return row;
}

elements.closeOtherGroups.addEventListener("change", async () => {
  state.settings.closeOtherTabGroupsWhenSwitching =
    elements.closeOtherGroups.checked;
  await saveSettings("Switching behavior saved.");
});

loadOptions().catch((error) => {
  console.error(error);
  setStatus(`Could not load options. ${error?.message ?? error}`);
});
