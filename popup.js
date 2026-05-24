"use strict";

const api = globalThis.browser;
const ungroupedId = api?.tabGroups?.TAB_GROUP_ID_NONE ?? -1;
const state = {
  activeWindowId: null,
  filter: "",
  groups: [],
  showAllWindows: false,
  tabsByGroupKey: new Map()
};

const elements = {
  list: document.querySelector("#groups-list"),
  searchInput: document.querySelector("#search-input"),
  showAllWindows: document.querySelector("#show-all-windows"),
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

function getStateText(group) {
  if (typeof group.collapsed !== "boolean") {
    return "State unavailable";
  }

  return group.collapsed ? "Collapsed" : "Expanded";
}

function getTabWord(count) {
  return count === 1 ? "tab" : "tabs";
}

function hasTabGroupSupport() {
  return Boolean(api?.tabGroups?.query && api?.tabs?.query && api?.tabs?.update);
}

async function getActiveWindowId() {
  const activeTabs = await api.tabs.query({ active: true, currentWindow: true });

  if (activeTabs[0]?.windowId !== undefined) {
    return activeTabs[0].windowId;
  }

  if (api.windows?.getCurrent) {
    const currentWindow = await api.windows.getCurrent();
    return currentWindow.id;
  }

  return null;
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

function getFilteredGroups() {
  const query = state.filter.trim().toLocaleLowerCase();

  if (!query) {
    return state.groups;
  }

  return state.groups.filter((group) =>
    getGroupTitle(group).toLocaleLowerCase().includes(query)
  );
}

function getColorValue(color) {
  return colorMap[color] ?? "var(--indicator)";
}

function createGroupButton(group) {
  const groupId = getGroupId(group);
  const tabs = getGroupTabs(group);
  const title = getGroupTitle(group);
  const button = document.createElement("button");
  button.className = "group-button";
  button.type = "button";
  button.dataset.groupId = String(groupId);
  button.setAttribute("role", "listitem");
  button.setAttribute(
    "aria-label",
    `${title}, ${tabs.length} ${getTabWord(tabs.length)}, ${getStateText(group)}`
  );

  const indicator = document.createElement("span");
  indicator.className = "color-dot";
  indicator.style.setProperty("--indicator", getColorValue(group.color));

  const text = document.createElement("span");
  text.className = "group-text";

  const titleElement = document.createElement("span");
  titleElement.className = "group-title";
  titleElement.textContent = title;

  const details = document.createElement("span");
  details.className = "group-detail";
  const windowText = state.showAllWindows ? ` - Window ${group.windowId}` : "";
  details.textContent = `${getStateText(group)}${windowText}`;

  const count = document.createElement("span");
  count.className = "tab-count";
  count.textContent = String(tabs.length);

  text.append(titleElement, details);
  button.append(indicator, text, count);
  button.addEventListener("click", () => activateGroup(group));

  return button;
}

function renderGroups() {
  clearList();
  const groups = getFilteredGroups();

  if (state.groups.length === 0) {
    setStatus(
      state.showAllWindows
        ? "No tab groups found."
        : "No tab groups in this window."
    );
    return;
  }

  if (groups.length === 0) {
    setStatus("No tab groups match your search.");
    return;
  }

  setStatus("");
  const fragment = document.createDocumentFragment();

  for (const group of groups) {
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
    state.activeWindowId = await getActiveWindowId();

    if (!state.showAllWindows && state.activeWindowId === null) {
      throw new Error("Could not determine the active Firefox window.");
    }

    const queryInfo = state.showAllWindows ? {} : { windowId: state.activeWindowId };
    const tabQueryInfo = state.showAllWindows ? {} : { windowId: state.activeWindowId };

    const [groups, tabs] = await Promise.all([
      api.tabGroups.query(queryInfo),
      api.tabs.query(tabQueryInfo)
    ]);
    const tabsByGroupKey = getTabsByGroupKey(tabs);

    state.tabsByGroupKey = tabsByGroupKey;
    state.groups = groups
      .filter((group) => getGroupId(group) !== undefined)
      .sort((first, second) => {
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
      });
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

async function activateGroup(group) {
  const targetTab = getTargetTab(group);

  if (!targetTab?.id) {
    setStatus("No tabs were found for this group.");
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

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.filter = event.target.value;
    renderGroups();
  });

  elements.showAllWindows.addEventListener("change", (event) => {
    state.showAllWindows = event.target.checked;
    loadGroups();
  });
}

bindEvents();
loadGroups();
