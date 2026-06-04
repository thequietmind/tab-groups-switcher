"use strict";

const api = globalThis.browser;
const storageKey = "rememberedGroups";
const settingsKey = "settings";
const defaultSettings = {
  minimizeOtherTabGroupsWhenSwitching: true,
  showRememberedClosedGroups: false
};
const colorOptions = new Set([
  "blue",
  "cyan",
  "gray",
  "grey",
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
  dropIndex: null,
  settings: { ...defaultSettings }
};
let pendingGroupSave = Promise.resolve();

const elements = {
  list: document.querySelector("#groups-list"),
  status: document.querySelector("#status"),
  minimizeOtherGroups: document.querySelector("#minimize-other-groups"),
  showRememberedClosedGroups: document.querySelector(
    "#show-remembered-closed-groups"
  )
};
const dropMarker = document.createElement("div");
dropMarker.className = "drop-marker";
dropMarker.setAttribute("aria-hidden", "true");

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
    autoCollapse: group.autoCollapse !== false,
    liveGroupKey: typeof group.liveGroupKey === "string" ? group.liveGroupKey : "",
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
  elements.minimizeOtherGroups.checked =
    state.settings.minimizeOtherTabGroupsWhenSwitching === true;
  elements.showRememberedClosedGroups.checked =
    state.settings.showRememberedClosedGroups === true;
}

function isAutoCollapseEnabled() {
  return state.settings.minimizeOtherTabGroupsWhenSwitching === true;
}

async function saveSettings(message = "Settings saved.") {
  await api.storage.local.set({ [settingsKey]: state.settings });
  setStatus(message);
}

async function saveGroups(message = "Order saved.") {
  const groupsToSave = state.groups.map((group, index) => ({
    ...group,
    order: index,
    updatedAt: Date.now()
  }));
  const previousSave = pendingGroupSave.catch(() => {});
  const saveOperation = previousSave.then(async () => {
    await api.storage.local.set({ [storageKey]: groupsToSave });
    setStatus(message);
  });

  state.groups = groupsToSave;
  pendingGroupSave = saveOperation;
  await saveOperation;
}

function setGroupAutoCollapse(groupId, autoCollapse) {
  state.groups = state.groups.map((group) => {
    if (group.id !== groupId) {
      return group;
    }

    return {
      ...group,
      autoCollapse
    };
  });
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
  fragment.append(createGroupsHeader());

  for (const group of state.groups) {
    fragment.append(createGroupRow(group));
  }

  elements.list.append(fragment);
}

function createGroupsHeader() {
  const header = document.createElement("div");
  header.className = "groups-header";

  const groupLabel = document.createElement("span");
  groupLabel.textContent = "Group";

  const autoCollapseLabel = document.createElement("span");
  autoCollapseLabel.textContent = "Auto-collapse";

  header.append(document.createElement("span"), groupLabel, autoCollapseLabel);
  return header;
}

function createGroupRow(group) {
  const row = document.createElement("article");
  row.className = "group-row";
  row.dataset.id = group.id;

  const handle = document.createElement("span");
  handle.className = "drag-handle";
  handle.draggable = true;
  handle.textContent = "⋮⋮";
  handle.title = "Drag to reorder";
  handle.style.cursor = "pointer";
  handle.setAttribute("aria-hidden", "true");

  const dot = document.createElement("span");
  dot.className = "color-dot";
  dot.style.setProperty("--indicator", colorMap[group.color] ?? colorMap.grey);

  const name = document.createElement("span");
  name.className = "group-name";
  name.textContent = group.name;

  const groupMain = document.createElement("span");
  groupMain.className = "group-main";
  groupMain.append(dot, name);

  const autoCollapseLabel = document.createElement("label");
  autoCollapseLabel.className = "auto-collapse-toggle";

  const autoCollapseInput = document.createElement("input");
  autoCollapseInput.type = "checkbox";
  autoCollapseInput.checked = group.autoCollapse !== false;
  autoCollapseInput.disabled = !isAutoCollapseEnabled();
  autoCollapseInput.setAttribute("aria-label", `Auto-collapse ${group.name}`);

  autoCollapseLabel.append(autoCollapseInput);
  autoCollapseInput.addEventListener("change", async () => {
    setGroupAutoCollapse(group.id, autoCollapseInput.checked);
    await saveGroups("Auto-collapse setting saved.");
  });

  handle.addEventListener("dragstart", (event) => {
    event.dataTransfer?.setData("text/plain", group.id);

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
    }

    state.draggedId = group.id;
    row.classList.add("dragging");
  });
  handle.addEventListener("dragend", () => {
    state.draggedId = null;
    clearDropMarker();
    row.classList.remove("dragging");
  });
  row.addEventListener("dragover", (event) => {
    event.preventDefault();

    if (!state.draggedId || state.draggedId === group.id) {
      clearDropMarker();
      return;
    }

    const rowBounds = row.getBoundingClientRect();
    const position =
      event.clientY < rowBounds.top + rowBounds.height / 2 ? "before" : "after";

    const targetIndex = state.groups.findIndex((item) => item.id === group.id);
    setDropMarker(row, position, targetIndex);
  });

  row.append(handle, groupMain, autoCollapseLabel);
  return row;
}

function clearDropMarker() {
  if (dropMarker.parentElement) {
    dropMarker.remove();
  }

  state.dropIndex = null;
}

function setDropMarker(row, position, targetIndex) {
  const dropIndex = position === "after" ? targetIndex + 1 : targetIndex;

  if (state.dropIndex === dropIndex && dropMarker.parentElement) {
    return;
  }

  state.dropIndex = dropIndex;

  if (position === "after") {
    row.after(dropMarker);
    return;
  }

  row.before(dropMarker);
}

async function dropDraggedGroup() {
  if (!state.draggedId || state.dropIndex === null) {
    clearDropMarker();
    return;
  }

  const draggedIndex = state.groups.findIndex((item) => item.id === state.draggedId);

  if (draggedIndex === -1) {
    clearDropMarker();
    return;
  }

  const [draggedGroup] = state.groups.splice(draggedIndex, 1);
  const adjustedDropIndex =
    draggedIndex < state.dropIndex ? state.dropIndex - 1 : state.dropIndex;
  const nextIndex = Math.min(
    Math.max(adjustedDropIndex, 0),
    state.groups.length
  );

  clearDropMarker();

  if (nextIndex === draggedIndex) {
    state.groups.splice(draggedIndex, 0, draggedGroup);
    return;
  }

  state.groups.splice(nextIndex, 0, draggedGroup);
  await saveGroups();
  renderGroups();
}

elements.list.addEventListener("dragover", (event) => event.preventDefault());
elements.list.addEventListener("drop", async (event) => {
  event.preventDefault();
  await dropDraggedGroup();
});

elements.minimizeOtherGroups.addEventListener("change", async () => {
  state.settings.minimizeOtherTabGroupsWhenSwitching =
    elements.minimizeOtherGroups.checked;
  await saveSettings("Switching behavior saved.");
  renderGroups();
});

elements.showRememberedClosedGroups.addEventListener("change", async () => {
  state.settings.showRememberedClosedGroups =
    elements.showRememberedClosedGroups.checked;
  await saveSettings("Remembered group visibility saved.");
});

loadOptions().catch((error) => {
  console.error(error);
  setStatus(`Could not load options. ${error?.message ?? error}`);
});
