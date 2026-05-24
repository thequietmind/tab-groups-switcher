# Tab Groups Switcher

A compact Firefox WebExtension for quickly switching between currently open
Firefox tab groups.

By default, the popup shows only open tab groups. Remembered closed tab groups
are an experimental opt-in feature for people who want the extension to recreate
groups it has previously tracked.

Firefox does not currently expose native saved tab groups to WebExtensions. When
remembered closed groups are enabled, the extension recreates them from stored
URLs instead of reopening Firefox's native saved group identity. This will
duplicate Firefox's own saved groups when those saved groups still exist.

## Install for Testing

1. Open Firefox and go to `about:debugging`.
2. Select **This Firefox**.
3. Click **Load Temporary Add-on...**.
4. Choose `manifest.json` from this folder.
5. Use the **Tab Groups Switcher** toolbar button to open the popup.

## Manual Test Checklist

1. Create one or more Firefox tab groups.
2. Open the toolbar popup and confirm each exposed group appears in one flat list
   with its color and title.
3. Click an open group and confirm Firefox focuses that window, expands the group
   if needed, and activates a tab in the group.
4. Close or save a group after it has been seen by the extension.
5. Reopen the popup and confirm the remembered closed group is hidden by default.
6. Open the extension options page and enable
   **Show remembered closed tab groups**.
7. Reopen the popup and confirm the remembered group appears with an outlined
   color dot and does not duplicate any currently open group.
8. Click the remembered group and confirm its tabs reopen in a recreated tab
   group with the saved title and color.
9. Disable **Show remembered closed tab groups** and confirm remembered groups
   are hidden again.
10. Open the extension options page and confirm tracked groups can be reordered.
11. Confirm **Minimize other tab groups when switching** is enabled, switch
    groups from the popup, and confirm other open groups collapse while
    ungrouped tabs remain open.

If the popup says `Firefox tab group extension APIs are not available in this
browser version.`, update Firefox to a version that supports the
`browser.tabGroups` WebExtensions API.

## Default Behavior

The extension is primarily a switcher for open Firefox tab groups. On a fresh
install, the toolbar popup lists only groups currently exposed by Firefox
through the `browser.tabGroups` API. Clicking a group focuses its window,
expands the group if needed, and activates a tab in that group.

The popup respects the saved manual order for tracked groups. Open groups that
match a tracked group use that saved order, while open groups that have not been
tracked yet appear after ordered groups.

## Experimental Remembering

The background script watches tab group and tab lifecycle events, then snapshots
every visible/open tab group with its title, color, ordered URLs, ordered tab
titles, and timestamps. Remembered groups are stored in `browser.storage.local`
and keep a manual `order` value for the popup.

Remembered closed groups stay hidden unless **Show remembered closed tab groups**
is enabled in options. When enabled, the popup shows open groups with filled
color dots and remembered closed groups with outlined color dots. When a
currently open group matches a remembered group, the popup hides the remembered
duplicate and clicking that row focuses the open group.

Matching favors exact URL signatures, then normalized group names plus URL
overlap. This avoids relying on Firefox group IDs being stable across sessions.

## Options

Open the extension options page to manage switching and remembered group
visibility:

- Reorder with drag and drop.
- Toggle whether switching to a group minimizes other currently open tab groups.
- Toggle whether remembered closed tab groups appear in the popup.

The ordering list is intentionally simple and only shows tracked group names.

## Switching Behavior

By default, switching groups first focuses or recreates the selected group, then
collapses the other open tab groups. Ungrouped tabs are not changed. Disable
**Minimize other tab groups when switching** if you want other open groups to
stay expanded.

## Restore Behavior

Firefox does not expose native saved tab groups directly to WebExtensions, and
the supported `sessions` API exposes recently closed entries as tabs or windows
rather than tab group records. Because of that, the extension cannot reopen a
specific native saved tab group by identity.

When remembered closed groups are enabled and you click a remembered group, the
extension first checks whether an equivalent group is already open and focuses
it. If it is closed, the extension recreates the group from the URLs it
previously remembered, then reconciles the new live group back into the existing
remembered record so the popup does not show duplicate entries.

## Development

To create a zip archive for uploading to the Add-on Developer Hub:

```sh
zip -r ../tab-groups-switcher.zip \
  manifest.json \
  background.js \
  popup.html \
  popup.css \
  popup.js \
  options.html \
  options.css \
  options.js \
  README.md \
  icons
```

## Limitations

This extension does not read Firefox profile files, inspect sessionstore
internals, use native messaging, or call undocumented APIs. It can only recreate
groups that it previously saw while they were open and exposed by Firefox.

## Bugzilla Tracking

- [Bug 1940631][bug-1940631]: Implement tabGroups WebExtensions API
- [Bug 1927769][bug-1927769]: Allow sessions.restore to understand tab groups
- [Bug 1968190][bug-1968190]: Closed grouped tabs and restore add-ons
- [Bug 1979759][bug-1979759]: Saved-and-closed groups in Recently Closed Tabs

[bug-1927769]: https://bugzilla.mozilla.org/show_bug.cgi?id=1927769
[bug-1940631]: https://bugzilla.mozilla.org/show_bug.cgi?id=1940631
[bug-1968190]: https://bugzilla.mozilla.org/show_bug.cgi?id=1968190
[bug-1979759]: https://bugzilla.mozilla.org/show_bug.cgi?id=1979759
