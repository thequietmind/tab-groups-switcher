# Tab Groups Switcher

A compact Firefox WebExtension for quickly switching between currently open
Firefox tab groups.

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
4. Open the extension options page and confirm it lists only open groups and
   that they can be reordered by dragging their handles.
5. In a group with a single tab, visit several different pages, then reload the
   options page and confirm the group is still listed once.
6. With the options page open, delete a group and confirm it disappears from
   the list.
7. Restart Firefox with session restore enabled and confirm restored groups keep
   their order and **Auto-collapse** settings.
8. Confirm **Minimize other tab groups when switching** is enabled, switch
   groups from the popup, and confirm other open groups collapse while
   ungrouped tabs remain open.
9. Uncheck **Auto-collapse** for one group, switch to another group from the
   popup, and confirm the unchecked group stays expanded.

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

## Group Tracking

The background script watches tab group and tab lifecycle events, then snapshots
every open tab group with its title, color, ordered URLs, ordered tab titles, and
timestamps. Tracked groups are stored in `browser.storage.local` so they keep a
manual `order` value and an **Auto-collapse** setting.

While Firefox is running, a tracked group follows its live group by window and
group ID, so navigating inside a group updates the same record. After a restart,
groups are matched by exact URL signatures, then normalized group names plus URL
overlap, which avoids relying on Firefox group IDs being stable across sessions.

When Firefox removes a group from a window that stays open, the extension
forgets it. Firefox reports deleting a group and saving and closing it the same
way, so a saved group you reopen later is tracked as a new group at the end of
the list. Groups that close along with their window are kept, because quitting
Firefox closes windows the same way, and session restore should bring them back
with their order and settings intact.

## Options

Open the extension options page to manage switching:

- Reorder open groups with drag and drop.
- Toggle whether switching to a group minimizes other currently open tab groups.
- Uncheck **Auto-collapse** for groups that should stay expanded during switch
  actions.

The group list shows only open groups and updates as groups are created,
renamed, or removed. Each row has a drag handle for ordering and an
**Auto-collapse** checkbox for per-group switching behavior.

## Switching Behavior

By default, switching groups first focuses the selected group, then collapses
the other open tab groups. Ungrouped tabs are not changed. Disable
**Minimize other tab groups when switching** if you want other open groups to
stay expanded. To keep only specific tracked groups expanded during switch
actions, uncheck **Auto-collapse** for those groups in options.

## Development

To create a zip archive for uploading to the Add-on Developer Hub:

```sh
rm ../tab-groups-switcher.zip && \
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
internals, use native messaging, or call undocumented APIs. Firefox does not
expose saved tab groups to WebExtensions, so the extension only sees open groups
and cannot tell a deleted group from a saved one.

## Bugzilla Tracking

- [Bug 1940631][bug-1940631]: Implement tabGroups WebExtensions API
- [Bug 1927769][bug-1927769]: Allow sessions.restore to understand tab groups
- [Bug 1968190][bug-1968190]: Closed grouped tabs and restore add-ons
- [Bug 1979759][bug-1979759]: Saved-and-closed groups in Recently Closed Tabs

[bug-1927769]: https://bugzilla.mozilla.org/show_bug.cgi?id=1927769
[bug-1940631]: https://bugzilla.mozilla.org/show_bug.cgi?id=1940631
[bug-1968190]: https://bugzilla.mozilla.org/show_bug.cgi?id=1968190
[bug-1979759]: https://bugzilla.mozilla.org/show_bug.cgi?id=1979759
