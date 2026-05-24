"use strict";

const api = globalThis.browser;
const storageKey = "rememberedGroups";
const colorOptions = [
  "grey",
  "blue",
  "cyan",
  "green",
  "orange",
  "pink",
  "purple",
  "red",
  "yellow"
];
const state = {
  groups: [],
  draggedId: null
};

const elements = {
  list: document.querySelector("#groups-list"),
  status: document.querySelector("#status"),
  exportButton: document.querySelector("#export-button"),
  importInput: document.querySelector("#import-input")
};

function setStatus(message) {
  elements.status.textContent = message;
}

function normalizeGroup(group, index) {
  const now = Date.now();
  const urls = Array.isArray(group.urls) ? group.urls.filter(Boolean) : [];
  const titles = Array.isArray(group.titles) ? group.titles : [];

  return {
    id: String(group.id || `imported-${now}-${index}`),
    name: String(group.name || "Untitled group"),
    color: colorOptions.includes(group.color) ? group.color : "grey",
    urls,
    titles: urls.map((_, urlIndex) => String(titles[urlIndex] ?? "")),
    order: Number.isFinite(group.order) ? group.order : index,
    createdAt: Number.isFinite(group.createdAt) ? group.createdAt : now,
    updatedAt: Number.isFinite(group.updatedAt) ? group.updatedAt : now,
    source: "auto-tracked"
  };
}

async function loadGroups() {
  const result = await api.storage.local.get({ [storageKey]: [] });
  const groups = Array.isArray(result[storageKey]) ? result[storageKey] : [];
  state.groups = groups
    .map(normalizeGroup)
    .sort((first, second) => first.order - second.order)
    .map((group, index) => ({ ...group, order: index }));
  renderGroups();
}

async function saveGroups(message = "Saved.") {
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
    fragment.append(createGroupEditor(group));
  }

  elements.list.append(fragment);
}

function createTextInput(group, property, labelText) {
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = document.createElement("input");
  input.value = group[property];
  input.addEventListener("change", async () => {
    group[property] = input.value.trim() || "Untitled group";
    await saveGroups("Group updated.");
  });
  label.append(input);
  return label;
}

function createColorSelect(group) {
  const label = document.createElement("label");
  label.textContent = "Color";
  const select = document.createElement("select");

  for (const color of colorOptions) {
    const option = document.createElement("option");
    option.value = color;
    option.textContent = color;
    option.selected = group.color === color;
    select.append(option);
  }

  select.addEventListener("change", async () => {
    group.color = select.value;
    await saveGroups("Color updated.");
  });
  label.append(select);
  return label;
}

function createUrlsField(group) {
  const label = document.createElement("label");
  label.className = "urls-field";
  label.textContent = "URLs";
  const textarea = document.createElement("textarea");
  textarea.spellcheck = false;
  textarea.value = group.urls.join("\n");
  textarea.addEventListener("change", async () => {
    const urls = textarea.value
      .split(/\n+/)
      .map((url) => url.trim())
      .filter(Boolean);
    group.urls = urls;
    group.titles = urls.map((_, index) => group.titles[index] ?? "");
    await saveGroups("URLs updated.");
  });
  label.append(textarea);
  return label;
}

function createActionButton(label, onClick, className) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;

  if (className) {
    button.className = className;
  }

  button.addEventListener("click", onClick);
  return button;
}

function moveGroup(id, direction) {
  const currentIndex = state.groups.findIndex((group) => group.id === id);
  const nextIndex = currentIndex + direction;

  if (currentIndex === -1 || nextIndex < 0 || nextIndex >= state.groups.length) {
    return;
  }

  const [group] = state.groups.splice(currentIndex, 1);
  state.groups.splice(nextIndex, 0, group);
}

function deleteGroup(id) {
  state.groups = state.groups.filter((group) => group.id !== id);
}

function createGroupEditor(group) {
  const editor = document.createElement("article");
  editor.className = "group-editor";
  editor.draggable = true;
  editor.dataset.id = group.id;

  const fields = document.createElement("div");
  fields.className = "fields";
  fields.append(
    createTextInput(group, "name", "Name"),
    createColorSelect(group),
    createUrlsField(group)
  );

  const actions = document.createElement("div");
  actions.className = "actions";
  actions.append(
    createActionButton("Up", async () => {
      moveGroup(group.id, -1);
      await saveGroups("Order updated.");
      renderGroups();
    }),
    createActionButton("Down", async () => {
      moveGroup(group.id, 1);
      await saveGroups("Order updated.");
      renderGroups();
    }),
    createActionButton(
      "Delete",
      async () => {
        deleteGroup(group.id);
        await saveGroups("Group deleted.");
        renderGroups();
      },
      "delete-button"
    )
  );

  editor.addEventListener("dragstart", () => {
    state.draggedId = group.id;
    editor.classList.add("dragging");
  });
  editor.addEventListener("dragend", () => {
    state.draggedId = null;
    editor.classList.remove("dragging");
  });
  editor.addEventListener("dragover", (event) => event.preventDefault());
  editor.addEventListener("drop", async (event) => {
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
    await saveGroups("Order updated.");
    renderGroups();
  });

  editor.append(fields, actions);
  return editor;
}

function exportGroups() {
  const data = JSON.stringify({ [storageKey]: state.groups }, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tab-groups-menu-backup.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function importGroups(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const importedGroups = Array.isArray(parsed)
    ? parsed
    : parsed?.[storageKey];

  if (!Array.isArray(importedGroups)) {
    throw new Error("Backup JSON must contain an array of groups.");
  }

  state.groups = importedGroups.map(normalizeGroup);
  await saveGroups("Backup imported.");
  renderGroups();
}

elements.exportButton.addEventListener("click", exportGroups);
elements.importInput.addEventListener("change", async () => {
  const [file] = elements.importInput.files;

  if (!file) {
    return;
  }

  try {
    await importGroups(file);
  } catch (error) {
    console.error(error);
    setStatus(`Import failed. ${error?.message ?? error}`);
  } finally {
    elements.importInput.value = "";
  }
});

loadGroups().catch((error) => {
  console.error(error);
  setStatus(`Could not load options. ${error?.message ?? error}`);
});
