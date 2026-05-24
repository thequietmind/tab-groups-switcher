"use strict";

const api = globalThis.browser;
const storageKey = "rememberedGroups";
const ungroupedId = api?.tabGroups?.TAB_GROUP_ID_NONE ?? -1;
const validColors = new Set([
  "blue",
  "cyan",
  "grey",
  "gray",
  "green",
  "orange",
  "pink",
  "purple",
  "red",
  "yellow"
]);

let snapshotTimer = null;

function getGroupName(group) {
  return String(group.title ?? group.name ?? "").trim() || "Untitled group";
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

function isGroupedTab(tab) {
  return tab.groupId !== undefined && tab.groupId !== ungroupedId;
}

function sortTabsByPosition(tabs) {
  return [...tabs].sort((first, second) => {
    if ((first.windowId ?? 0) !== (second.windowId ?? 0)) {
      return (first.windowId ?? 0) - (second.windowId ?? 0);
    }

    return (first.index ?? 0) - (second.index ?? 0);
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

function getTabsForGroup(group, tabsByGroupKey) {
  const keyedTabs = tabsByGroupKey.get(getGroupKey(group));

  if (keyedTabs) {
    return keyedTabs;
  }

  const groupId = getGroupId(group);
  const matchingTabs = [];

  for (const groupTabs of tabsByGroupKey.values()) {
    if (groupTabs[0]?.groupId === groupId) {
      matchingTabs.push(...groupTabs);
    }
  }

  return sortTabsByPosition(matchingTabs);
}

function normalizeName(name) {
  return String(name ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

function normalizeUrl(url) {
  try {
    const parsedUrl = new URL(url);
    parsedUrl.hash = "";

    if (parsedUrl.pathname !== "/") {
      parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/, "");
    }

    return parsedUrl.toString();
  } catch {
    return String(url ?? "").trim();
  }
}

function hashString(value) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function getUrlSet(group) {
  return new Set((group.urls ?? []).map(normalizeUrl).filter(Boolean));
}

function getUrlOverlap(firstGroup, secondGroup) {
  const firstUrls = getUrlSet(firstGroup);
  const secondUrls = getUrlSet(secondGroup);

  if (firstUrls.size === 0 && secondUrls.size === 0) {
    return 1;
  }

  if (firstUrls.size === 0 || secondUrls.size === 0) {
    return 0;
  }

  let matches = 0;

  for (const url of firstUrls) {
    if (secondUrls.has(url)) {
      matches += 1;
    }
  }

  return matches / Math.max(firstUrls.size, secondUrls.size);
}

function getRememberedId(snapshot) {
  const name = normalizeName(snapshot.name) || "untitled group";
  const urlSignature = (snapshot.urls ?? [])
    .map(normalizeUrl)
    .filter(Boolean)
    .slice(0, 8)
    .join("|");

  return `group-${hashString(`${name}|${urlSignature}`)}`;
}

function hasExactUrlOrder(firstGroup, secondGroup) {
  const firstUrls = (firstGroup.urls ?? []).map(normalizeUrl).filter(Boolean);
  const secondUrls = (secondGroup.urls ?? []).map(normalizeUrl).filter(Boolean);

  return (
    firstUrls.length > 0 &&
    secondUrls.length > 0 &&
    firstUrls.join("|") === secondUrls.join("|")
  );
}

function hasUniqueNameMatch(snapshot, rememberedGroup, rememberedGroups) {
  const snapshotName = normalizeName(snapshot.name);

  if (!snapshotName || normalizeName(rememberedGroup.name) !== snapshotName) {
    return false;
  }

  return (
    rememberedGroups.filter((group) => normalizeName(group.name) === snapshotName)
      .length === 1
  );
}

function findRememberedMatch(snapshot, rememberedGroups, options = {}) {
  const snapshotName = normalizeName(snapshot.name);
  let bestMatch = null;
  let bestScore = 0;

  for (const rememberedGroup of rememberedGroups) {
    const nameMatches = normalizeName(rememberedGroup.name) === snapshotName;
    const overlap = getUrlOverlap(snapshot, rememberedGroup);

    if (hasExactUrlOrder(snapshot, rememberedGroup)) {
      return rememberedGroup;
    }

    if (
      options.allowNameOnly &&
      hasUniqueNameMatch(snapshot, rememberedGroup, rememberedGroups)
    ) {
      return rememberedGroup;
    }

    const score = (nameMatches ? 0.5 : 0) + overlap;

    if ((nameMatches && overlap >= 0.15) || overlap >= 0.7) {
      if (score > bestScore) {
        bestMatch = rememberedGroup;
        bestScore = score;
      }
    }
  }

  return bestMatch;
}

function normalizeStoredGroup(group, index) {
  const now = Date.now();
  const urls = Array.isArray(group.urls) ? group.urls.filter(Boolean) : [];
  const titles = Array.isArray(group.titles) ? group.titles : [];

  return {
    id: String(group.id || getRememberedId(group)),
    name: String(group.name || "Untitled group"),
    color: String(group.color || "grey"),
    urls,
    titles: urls.map((_, urlIndex) => String(titles[urlIndex] ?? "")),
    order: Number.isFinite(group.order) ? group.order : index,
    createdAt: Number.isFinite(group.createdAt) ? group.createdAt : now,
    updatedAt: Number.isFinite(group.updatedAt) ? group.updatedAt : now,
    source: "auto-tracked"
  };
}

async function loadRememberedGroups() {
  const result = await api.storage.local.get({ [storageKey]: [] });
  const rememberedGroups = Array.isArray(result[storageKey])
    ? result[storageKey]
    : [];

  return compactRememberedGroups(
    rememberedGroups.map(normalizeStoredGroup)
  ).sort((first, second) => first.order - second.order);
}

function compactRememberedGroups(groups) {
  const compactedGroups = [];

  for (const group of groups) {
    const existingGroup = compactedGroups.find((candidate) => {
      const namesMatch = normalizeName(candidate.name) === normalizeName(group.name);
      const oneGroupHasNoUrls =
        (candidate.urls ?? []).length === 0 || (group.urls ?? []).length === 0;

      return (
        hasExactUrlOrder(candidate, group) ||
        (namesMatch && (oneGroupHasNoUrls || getUrlOverlap(candidate, group) >= 0.7))
      );
    });

    if (!existingGroup) {
      compactedGroups.push(group);
      continue;
    }

    if ((group.urls ?? []).length > (existingGroup.urls ?? []).length) {
      existingGroup.urls = group.urls;
      existingGroup.titles = group.titles;
    }

    existingGroup.name = existingGroup.name || group.name;
    existingGroup.color = existingGroup.color || group.color;
    existingGroup.createdAt = Math.min(existingGroup.createdAt, group.createdAt);
    existingGroup.updatedAt = Math.max(existingGroup.updatedAt, group.updatedAt);
  }

  return compactedGroups;
}

async function saveRememberedGroups(groups) {
  const normalizedGroups = compactRememberedGroups(
    groups.map((group, index) => normalizeStoredGroup(group, index))
  ).map((group, index) => ({
    ...group,
    order: index
  }));

  await api.storage.local.set({ [storageKey]: normalizedGroups });
  return normalizedGroups;
}

async function updateRememberedGroup(rememberedGroupId, updates) {
  const rememberedGroups = await loadRememberedGroups();
  const groupIndex = rememberedGroups.findIndex(
    (group) => group.id === rememberedGroupId
  );

  if (groupIndex === -1) {
    return saveRememberedGroups(rememberedGroups);
  }

  rememberedGroups[groupIndex] = {
    ...rememberedGroups[groupIndex],
    ...updates,
    id: rememberedGroupId,
    updatedAt: Date.now(),
    source: "auto-tracked"
  };

  return saveRememberedGroups(rememberedGroups);
}

function getGroupSnapshot(group, groupTabs) {
  return {
    name: getGroupName(group),
    color: String(group.color || "grey"),
    urls: groupTabs.map((tab) => tab.url).filter(Boolean),
    titles: groupTabs.map((tab) => tab.title ?? ""),
    updatedAt: Date.now()
  };
}

async function queryOpenGroupSnapshots() {
  if (!api?.tabGroups?.query || !api?.tabs?.query) {
    return [];
  }

  const [groups, tabs] = await Promise.all([
    api.tabGroups.query({}),
    api.tabs.query({})
  ]);
  const tabsByGroupKey = getTabsByGroupKey(tabs);

  return groups
    .map((group) => {
      const groupTabs = getTabsForGroup(group, tabsByGroupKey);

      return {
        group,
        tabs: groupTabs,
        snapshot: getGroupSnapshot(group, groupTabs)
      };
    })
    .filter(({ group, tabs }) => getGroupId(group) !== undefined && tabs.length > 0)
    .sort((first, second) => {
      const firstWindow = first.group.windowId ?? 0;
      const secondWindow = second.group.windowId ?? 0;

      if (firstWindow !== secondWindow) {
        return firstWindow - secondWindow;
      }

      const firstTabIndex = first.tabs[0]?.index ?? Number.MAX_SAFE_INTEGER;
      const secondTabIndex = second.tabs[0]?.index ?? Number.MAX_SAFE_INTEGER;

      return firstTabIndex - secondTabIndex;
    });
}

async function snapshotOpenGroups() {
  const openSnapshots = await queryOpenGroupSnapshots();

  if (openSnapshots.length === 0) {
    return loadRememberedGroups();
  }

  const rememberedGroups = await loadRememberedGroups();
  const nextGroups = [...rememberedGroups];

  for (const { snapshot } of openSnapshots) {
    const existingGroup = findRememberedMatch(snapshot, nextGroups, {
      allowNameOnly: true
    });
    const now = Date.now();

    if (existingGroup) {
      existingGroup.name = snapshot.name;
      existingGroup.color = snapshot.color;
      existingGroup.urls = snapshot.urls;
      existingGroup.titles = snapshot.titles;
      existingGroup.updatedAt = now;
      existingGroup.source = "auto-tracked";
      continue;
    }

    nextGroups.push({
      id: getRememberedId(snapshot),
      name: snapshot.name,
      color: snapshot.color,
      urls: snapshot.urls,
      titles: snapshot.titles,
      order: nextGroups.length,
      createdAt: now,
      updatedAt: now,
      source: "auto-tracked"
    });
  }

  return saveRememberedGroups(nextGroups);
}

function scheduleSnapshot() {
  if (snapshotTimer !== null) {
    clearTimeout(snapshotTimer);
  }

  snapshotTimer = setTimeout(() => {
    snapshotTimer = null;
    snapshotOpenGroups().catch((error) => console.error(error));
  }, 350);
}

function getOpenIds(openSnapshots, rememberedGroups) {
  const openIds = new Set();

  for (const rememberedGroup of rememberedGroups) {
    if (isRememberedGroupOpen(rememberedGroup, openSnapshots)) {
      openIds.add(rememberedGroup.id);
    }
  }

  return openIds;
}

function isRememberedGroupOpen(rememberedGroup, openSnapshots) {
  const rememberedName = normalizeName(rememberedGroup.name);

  for (const { snapshot } of openSnapshots) {
    const snapshotName = normalizeName(snapshot.name);

    if (hasExactUrlOrder(snapshot, rememberedGroup)) {
      return true;
    }

    if (rememberedName && snapshotName === rememberedName) {
      return true;
    }

    if (getUrlOverlap(snapshot, rememberedGroup) >= 0.7) {
      return true;
    }
  }

  return false;
}

async function getMenuGroups() {
  const rememberedGroups = await snapshotOpenGroups();
  const openSnapshots = await queryOpenGroupSnapshots();
  const openIds = getOpenIds(openSnapshots, rememberedGroups);
  const openGroups = openSnapshots.map(({ group, tabs, snapshot }) => {
    const rememberedMatch = findRememberedMatch(snapshot, rememberedGroups, {
      allowNameOnly: true
    });
    const targetTab = tabs.find((tab) => !tab.discarded) ?? tabs[0];

    return {
      id: rememberedMatch?.id ?? getRememberedId(snapshot),
      type: "open",
      name: snapshot.name,
      color: snapshot.color,
      groupId: getGroupId(group),
      windowId: group.windowId,
      tabId: targetTab?.id
    };
  });
  const rememberedMenuGroups = rememberedGroups
    .filter((group) => !openIds.has(group.id))
    .map((group) => ({
      id: group.id,
      type: "remembered",
      name: group.name,
      color: group.color
    }));

  return [...openGroups, ...rememberedMenuGroups];
}

async function activateOpenGroup(groupId, windowId, tabId) {
  if (api.tabGroups?.update) {
    await api.tabGroups.update(groupId, { collapsed: false });
  }

  if (windowId !== undefined && api.windows?.update) {
    await api.windows.update(windowId, { focused: true });
  }

  if (tabId !== undefined) {
    await api.tabs.update(tabId, { active: true });
  }
}

function findOpenMatchForRememberedGroup(rememberedGroup, openSnapshots) {
  return openSnapshots.find(({ snapshot }) => {
    return (
      findRememberedMatch(snapshot, [rememberedGroup], {
        allowNameOnly: true
      })?.id === rememberedGroup.id
    );
  });
}

async function focusOpenRememberedGroup(rememberedGroup) {
  const openMatch = findOpenMatchForRememberedGroup(
    rememberedGroup,
    await queryOpenGroupSnapshots()
  );

  if (!openMatch) {
    return false;
  }

  const targetTab = openMatch.tabs.find((tab) => !tab.discarded) ?? openMatch.tabs[0];
  await activateOpenGroup(
    getGroupId(openMatch.group),
    openMatch.group.windowId,
    targetTab?.id
  );
  return true;
}

async function recreateRememberedGroup(rememberedGroup) {
  if (!api?.tabs?.create || !api?.tabs?.group || !api?.tabGroups?.update) {
    throw new Error("This Firefox version cannot create tab groups from extensions.");
  }

  const urls = rememberedGroup.urls.length > 0 ? rememberedGroup.urls : ["about:blank"];
  const createdTabs = [];

  for (const [index, url] of urls.entries()) {
    const tab = await api.tabs.create({
      url,
      active: index === 0
    });
    createdTabs.push(tab);
  }

  const tabIds = createdTabs.map((tab) => tab.id).filter((id) => id !== undefined);
  const groupIdResult = await api.tabs.group({ tabIds });
  const updateProperties = {
    collapsed: false,
    title: rememberedGroup.name
  };

  if (validColors.has(rememberedGroup.color)) {
    updateProperties.color = rememberedGroup.color;
  }

  await api.tabGroups.update(groupIdResult, updateProperties);

  const firstTab = createdTabs[0];

  if (firstTab?.windowId !== undefined && api.windows?.update) {
    await api.windows.update(firstTab.windowId, { focused: true });
  }

  if (firstTab?.id !== undefined) {
    await api.tabs.update(firstTab.id, { active: true });
  }

  await updateRememberedGroup(rememberedGroup.id, {
    name: rememberedGroup.name,
    color: rememberedGroup.color,
    urls: createdTabs.map((tab) => tab.url).filter(Boolean),
    titles: createdTabs.map((tab) => tab.title ?? "")
  });
  await snapshotOpenGroups();
}

async function openRememberedGroup(groupId) {
  const rememberedGroups = await loadRememberedGroups();
  const rememberedGroup = rememberedGroups.find((group) => group.id === groupId);

  if (!rememberedGroup) {
    throw new Error("That remembered group no longer exists.");
  }

  if (await focusOpenRememberedGroup(rememberedGroup)) {
    return;
  }

  await recreateRememberedGroup(rememberedGroup);
}

function onMessage(message) {
  if (message?.type === "getMenuGroups") {
    return getMenuGroups();
  }

  if (message?.type === "activateOpenGroup") {
    return activateOpenGroup(message.groupId, message.windowId, message.tabId);
  }

  if (message?.type === "openRememberedGroup") {
    return openRememberedGroup(message.id);
  }

  if (message?.type === "snapshotOpenGroups") {
    return snapshotOpenGroups();
  }

  return undefined;
}

function addListener(target, handler) {
  if (target?.addListener) {
    target.addListener(handler);
  }
}

api.runtime.onMessage.addListener(onMessage);
addListener(api.runtime.onInstalled, scheduleSnapshot);
addListener(api.runtime.onStartup, scheduleSnapshot);
addListener(api.tabGroups?.onCreated, scheduleSnapshot);
addListener(api.tabGroups?.onUpdated, scheduleSnapshot);
addListener(api.tabGroups?.onRemoved, scheduleSnapshot);
addListener(api.tabs?.onCreated, scheduleSnapshot);
addListener(api.tabs?.onUpdated, scheduleSnapshot);
addListener(api.tabs?.onRemoved, scheduleSnapshot);
addListener(api.tabs?.onMoved, scheduleSnapshot);
addListener(api.tabs?.onAttached, scheduleSnapshot);
addListener(api.tabs?.onDetached, scheduleSnapshot);
scheduleSnapshot();
