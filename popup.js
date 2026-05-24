"use strict";

const api = globalThis.browser;
const ungroupedId = api?.tabGroups?.TAB_GROUP_ID_NONE ?? -1;
const state = {
  groups: [],
  tabsByGroupKey: new Map()
};

const elements = {
  list: document.querySelector("#groups-list"),
  status: document.querySelector("#status")
};

const colorMap = {
  blue: "#45a1ff",
  cyan: "#00c8d7",
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

function getGroupId(group) {
  return group.id ?? group.groupId;
}

function getGroupKey(group) {
  const groupId = getGroupId(group);

  if (group.windowId === undefined) {
    return String(groupId);
  }

  return `${group.windowId}:${groupId}`;
}

function getTabGroupKey(tab) {
  if (tab.windowId === undefined) {
    return String(tab.groupId);
  }

  return `${tab.windowId}:${tab.groupId}`;
}

function getGroupTitle(group) {
  const title = group.title?.trim();
  return title || "Untitled group";
}

function hasTabGroupSupport() {
  return Boolean(api?.tabGroups?.query && api?.tabs?.query && api?.tabs?.update);
}

function isGroupedTab(tab) {
  return tab.groupId !== undefined && tab.groupId !== ungroupedId;
}

function sortTabsByPosition(tabs) {
  return [...tabs].sort((first, second) => {
    if (first.windowId !== second.windowId) {
      return first.windowId - second.windowId;
    }

    return first.index - second.index;
  });
}

function getTabsByGroupKey(tabs) {
  const tabsByGroupKey = new Map();

  for (const tab of tabs) {
    if (!isGroupedTab(tab)) {
      continue;
    }

    const groupKey = getTabGroupKey(tab);
    const groupTabs = tabsByGroupKey.get(groupKey) ?? [];
    groupTabs.push(tab);
    tabsByGroupKey.set(groupKey, groupTabs);
  }

  for (const [groupKey, groupTabs] of tabsByGroupKey) {
    tabsByGroupKey.set(groupKey, sortTabsByPosition(groupTabs));
  }

  return tabsByGroupKey;
}

function getGroupTabs(group) {
  return state.tabsByGroupKey.get(getGroupKey(group)) ?? [];
}

function getColorValue(color) {
  return colorMap[color] ?? "var(--indicator)";
}

function createGroupButton(group) {
  const groupId = getGroupId(group);
  const title = getGroupTitle(group);
  const button = document.createElement("button");
  button.className = "group-button";
  button.type = "button";
  button.dataset.groupId = String(groupId);
  button.setAttribute("role", "listitem");
  button.setAttribute("aria-label", title);

  const indicator = document.createElement("span");
  indicator.className = "color-dot";
  indicator.style.setProperty("--indicator", getColorValue(group.color));

  const titleElement = document.createElement("span");
  titleElement.className = "group-title";
  titleElement.textContent = title;

  button.append(indicator, titleElement);
  button.addEventListener("click", () => activateOpenGroup(group));

  return button;
}

function renderGroups() {
  clearList();

  if (state.groups.length === 0) {
    setStatus("No tab groups.");
    return;
  }

  setStatus("");
  const fragment = document.createDocumentFragment();

  for (const group of state.groups) {
    fragment.append(createGroupButton(group));
  }

  elements.list.append(fragment);
}

function compareGroupsByTabPosition(first, second) {
  const firstWindow = first.windowId ?? 0;
  const secondWindow = second.windowId ?? 0;

  if (firstWindow !== secondWindow) {
    return firstWindow - secondWindow;
  }

  const firstTabIndex = getGroupTabs(first)[0]?.index ?? Number.MAX_SAFE_INTEGER;
  const secondTabIndex = getGroupTabs(second)[0]?.index ?? Number.MAX_SAFE_INTEGER;

  if (firstTabIndex !== secondTabIndex) {
    return firstTabIndex - secondTabIndex;
  }

  return getGroupId(first) - getGroupId(second);
}

async function loadGroups() {
  if (!hasTabGroupSupport()) {
    setStatus("Firefox tab group extension APIs are not available in this browser version.");
    clearList();
    return;
  }

  try {
    setStatus("Loading tab groups...");
    // Firefox currently exposes only tab groups with visible/open tabs to WebExtensions.
    const [groups, tabs] = await Promise.all([
      api.tabGroups.query({}),
      api.tabs.query({})
    ]);

    state.tabsByGroupKey = getTabsByGroupKey(tabs);
    state.groups = groups
      .filter((group) => getGroupId(group) !== undefined)
      .sort(compareGroupsByTabPosition);
    renderGroups();
  } catch (error) {
    console.error(error);
    setStatus(getReadableError(error));
    clearList();
  }
}

function getReadableError(error) {
  const message = error?.message ?? String(error);

  if (message.toLowerCase().includes("tabgroups")) {
    return "Firefox tab group extension APIs are not available in this browser version.";
  }

  return `Could not load tab groups. ${message}`;
}

async function expandGroupIfNeeded(group) {
  if (group.collapsed !== true || !api.tabGroups?.update) {
    return;
  }

  await api.tabGroups.update(getGroupId(group), { collapsed: false });
}

async function focusWindow(windowId) {
  if (windowId === undefined || !api.windows?.update) {
    return;
  }

  await api.windows.update(windowId, { focused: true });
}

function getTargetTab(group) {
  const tabs = getGroupTabs(group);
  return tabs.find((tab) => !tab.discarded) ?? tabs[0] ?? null;
}

async function activateOpenGroup(group) {
  const targetTab = getTargetTab(group);

  if (!targetTab?.id) {
    setStatus("Saved or closed tab groups cannot be restored by WebExtensions yet.");
    return;
  }

  try {
    await expandGroupIfNeeded(group);
    await focusWindow(targetTab.windowId);
    await api.tabs.update(targetTab.id, { active: true });
    window.close();
  } catch (error) {
    console.error(error);
    setStatus(`Could not switch to that group. ${error?.message ?? error}`);
  }
}

loadGroups();
