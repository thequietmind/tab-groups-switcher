# Tab Groups Menu

A compact Firefox WebExtension for jumping between open tab groups and recreating groups the extension has automatically remembered.

Firefox does not currently expose native saved tab groups to WebExtensions. This extension works within that limitation by quietly snapshotting tab groups while Firefox exposes them as open groups, then keeping those snapshots in `browser.storage.local`.

## Install for Testing

1. Open Firefox and go to `about:debugging`.
2. Select **This Firefox**.
3. Click **Load Temporary Add-on...**.
4. Choose `manifest.json` from this folder.
5. Use the **Tab Groups Menu** toolbar button to open the popup.

## Manual Test Checklist

1. Create one or more Firefox tab groups.
2. Open the toolbar popup and confirm each exposed group appears in one flat list with its color and title.
3. Click an open group and confirm Firefox focuses that window, expands the group if needed, and activates a tab in the group.
4. Close or save a group after it has been seen by the extension.
5. Reopen the popup and confirm the remembered group remains without duplicating any currently open group.
6. Click the remembered group and confirm its tabs reopen in a recreated tab group with the saved title and color.
7. Open the extension options page and confirm remembered groups can be reordered.
8. Enable **Close other tab groups when switching**, switch groups from the popup, and confirm other open groups close while ungrouped tabs remain open.

If the popup says `Firefox tab group extension APIs are not available in this browser version.`, update Firefox to a version that supports the `browser.tabGroups` WebExtensions API.

## Automatic Remembering

The background script watches tab group and tab lifecycle events, then snapshots every visible/open tab group with its title, color, ordered URLs, ordered tab titles, and timestamps. Remembered groups are stored in `browser.storage.local` and keep a manual `order` value for the popup.

Open groups are shown first. Remembered groups are shown second, in the saved manual order. When a currently open group matches a remembered group, the popup hides the remembered duplicate and clicking that group focuses the open copy.

Matching favors exact URL signatures, then normalized group names plus URL overlap. This avoids relying on Firefox group IDs being stable across sessions.

## Options

Open the extension options page to manage remembered groups:

- Reorder with drag and drop or the Up/Down buttons.
- Toggle whether switching to a group closes other currently open tab groups.

The popup respects the saved manual order for remembered groups. Matching open groups use the same saved order, and newly discovered open groups are appended until the extension records them.

## Switching Behavior

By default, switching groups leaves all other open groups alone. If **Close other tab groups when switching** is enabled, the extension first focuses or recreates the selected group, then closes tabs belonging to other open tab groups. Ungrouped tabs are not closed.

## Restore Behavior

Firefox does not expose native saved tab groups directly to WebExtensions, and the supported `sessions` API exposes recently closed entries as tabs or windows rather than tab group records. Because of that, the extension cannot reopen a specific native saved tab group by identity.

When you click a remembered group, the extension first checks whether an equivalent group is already open and focuses it. If it is closed, the extension recreates the group from the URLs it previously remembered, then reconciles the new live group back into the existing remembered record so the popup does not show duplicate entries.

## Limitations

This extension does not read Firefox profile files, inspect sessionstore internals, use native messaging, or call undocumented APIs. It can only recreate groups that it previously saw while they were open and exposed by Firefox.

## Bugzilla Tracking

- [Bug 1940631: Implement tabGroups WebExtensions API](https://bugzilla.mozilla.org/show_bug.cgi?id=1940631)
- [Bug 1927769: Allow sessions.restore WebExtension API to understand tab groups](https://bugzilla.mozilla.org/show_bug.cgi?id=1927769)
- [Bug 1968190: Tabs closed in tab groups are not properly reported to restore-closed-tabs add-ons](https://bugzilla.mozilla.org/show_bug.cgi?id=1968190)
- [Bug 1979759: Saved-and-closed tab groups should appear in Recently Closed Tabs](https://bugzilla.mozilla.org/show_bug.cgi?id=1979759)
