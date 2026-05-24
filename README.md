# Tab Groups Menu

A compact Firefox WebExtension popup for jumping between the open tab groups exposed by Firefox.

## Install for Testing

1. Open Firefox and go to `about:debugging`.
2. Select **This Firefox**.
3. Click **Load Temporary Add-on...**.
4. Choose `manifest.json` from this folder.
5. Use the **Tab Groups Menu** toolbar button to open the popup.

## Manual Test Checklist

1. Create one or more Firefox tab groups.
2. Open the toolbar popup and confirm each exposed group appears in one flat list with its color and title.
3. Click a group and confirm Firefox focuses that window, expands the group if needed, and activates a tab in the group.

If the popup says `Firefox tab group extension APIs are not available in this browser version.`, update Firefox to a version that supports the `browser.tabGroups` WebExtensions API.

## Saved or Closed Tab Groups

Firefox's native tab groups menu can show recently saved or closed tab groups, but current WebExtensions APIs do not expose those groups directly. The `browser.tabGroups` API exposes tab groups with visible/open tab state, while the `browser.sessions` API restores closed tabs or windows and does not expose tab group IDs for saved groups.

Because of that API limitation, this extension lists all currently exposed open tab groups in one native-feeling flat menu. It does not create fake saved groups or maintain separate extension-owned persistence.

## Bugzilla Tracking

- [Bug 1940631: Implement tabGroups WebExtensions API](https://bugzilla.mozilla.org/show_bug.cgi?id=1940631)
- [Bug 1927769: Allow sessions.restore WebExtension API to understand tab groups](https://bugzilla.mozilla.org/show_bug.cgi?id=1927769)
- [Bug 1968190: Tabs closed in tab groups are not properly reported to restore-closed-tabs add-ons](https://bugzilla.mozilla.org/show_bug.cgi?id=1968190)
- [Bug 1979759: Saved-and-closed tab groups should appear in Recently Closed Tabs](https://bugzilla.mozilla.org/show_bug.cgi?id=1979759)
