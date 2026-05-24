"use strict";

const api = globalThis.browser;
const settingsKey = "settings";
const defaultSettings = {
  minimizeOtherTabGroupsWhenSwitching: false,
  showRememberedClosedGroups: false
};
const state = {
  groups: []
};

const elements = {
  list: document.querySelector("#groups-list"),
  status: document.querySelector("#status")
};

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

function setStatus(message) {
  elements.status.textContent = message;
}

function clearList() {
  elements.list.replaceChildren();
}

function getGroupTitle(group) {
  const title = group.name?.trim();
  return title || "Untitled group";
}

function hasTabGroupSupport() {
  return Boolean(api?.runtime?.sendMessage);
}

function getColorValue(color) {
  return colorMap[color] ?? "var(--indicator)";
}

function createGroupButton(group) {
  const title = getGroupTitle(group);
  const button = document.createElement("button");
  button.className = `group-button group-button-${group.type}`;
  button.type = "button";
  button.dataset.groupId = group.id;
  button.dataset.groupType = group.type;
  button.setAttribute("role", "menuitem");
  button.setAttribute(
    "aria-label",
    group.type === "open" ? `${title}, open` : `${title}, remembered`
  );

  const indicator = document.createElement("span");
  indicator.className = `color-dot color-dot-${group.type}`;
  indicator.style.setProperty("--indicator", getColorValue(group.color));

  const titleElement = document.createElement("span");
  titleElement.className = "group-title";
  titleElement.textContent = title;

  button.append(indicator, titleElement);
  button.addEventListener("click", () => activateGroup(group));

  return button;
}

function renderGroups() {
  clearList();

  if (state.groups.length === 0) {
    setStatus("No open tab groups.");
    return;
  }

  setStatus("");
  const fragment = document.createDocumentFragment();

  for (const group of state.groups) {
    fragment.append(createGroupButton(group));
  }

  elements.list.append(fragment);
}

async function loadGroups() {
  if (!hasTabGroupSupport()) {
    setStatus("Firefox tab group extension APIs are not available in this browser version.");
    clearList();
    return;
  }

  try {
    setStatus("Loading tab groups...");
    const settings = await loadSettings();
    state.groups =
      (await api.runtime.sendMessage({
        type: "getMenuGroups",
        includeRememberedGroups: settings.showRememberedClosedGroups === true
      })) ?? [];
    renderGroups();
  } catch (error) {
    console.error(error);
    setStatus(getReadableError(error));
    clearList();
  }
}

async function loadSettings() {
  const result = await api.storage.local.get({ [settingsKey]: defaultSettings });

  return {
    ...defaultSettings,
    ...(result[settingsKey] ?? {})
  };
}

function getReadableError(error) {
  const message = error?.message ?? String(error);

  if (message.toLowerCase().includes("tabgroups")) {
    return "Firefox tab group extension APIs are not available in this browser version.";
  }

  return `Could not load tab groups. ${message}`;
}

async function activateGroup(group) {
  try {
    setStatus("");
    const settings = await loadSettings();
    const minimizeOtherGroups =
      settings.minimizeOtherTabGroupsWhenSwitching === true;

    if (group.type === "open") {
      await api.runtime.sendMessage({
        type: "activateOpenGroup",
        groupId: group.groupId,
        windowId: group.windowId,
        tabId: group.tabId,
        minimizeOtherGroups
      });
    } else {
      await api.runtime.sendMessage({
        type: "openRememberedGroup",
        id: group.id,
        minimizeOtherGroups
      });
    }

    window.close();
  } catch (error) {
    console.error(error);
    setStatus(`Could not open that group. ${error?.message ?? error}`);
  }
}

elements.list.addEventListener("keydown", (event) => {
  const buttons = [...elements.list.querySelectorAll(".group-button")];
  const currentIndex = buttons.indexOf(document.activeElement);

  if (buttons.length === 0 || currentIndex === -1) {
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    buttons[(currentIndex + 1) % buttons.length].focus();
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    buttons[(currentIndex - 1 + buttons.length) % buttons.length].focus();
  }

  if (event.key === "Home") {
    event.preventDefault();
    buttons[0].focus();
  }

  if (event.key === "End") {
    event.preventDefault();
    buttons[buttons.length - 1].focus();
  }
});

loadGroups();
