# Tab Groups Menu

A compact Firefox WebExtension popup for jumping between tab groups in the active browser window.

## Install for Testing

1. Open Firefox and go to `about:debugging`.
2. Select **This Firefox**.
3. Click **Load Temporary Add-on...**.
4. Choose `manifest.json` from this folder.
5. Use the **Tab Groups Menu** toolbar button to open the popup.

## Manual Test Checklist

1. Create one or more Firefox tab groups in the active browser window.
2. Open the toolbar popup and confirm each group appears with its color, title, tab count, and collapsed or expanded state.
3. Search by group title and confirm the list filters immediately.
4. Click a group and confirm Firefox focuses that window, expands the group if needed, and activates a tab in the group.
5. Toggle **All windows** to include groups from other open Firefox windows.

If the popup says `Firefox tab group extension APIs are not available in this browser version.`, update Firefox to a version that supports the `browser.tabGroups` WebExtensions API.
