# Settings Reference

Every setting Trevor exposes, what it does, and where it's persisted. Open settings with **Mod + ,**.

Settings are stored in:

- **Desktop app:** the platform's standard config directory (`~/.config/Trevor/` on Linux, `~/Library/Application Support/Trevor/` on macOS, `%APPDATA%\Trevor\` on Windows).
- **Web preview:** `localStorage` under the key `trevor:settings`.

---

## Appearance

| Setting | Default | Description |
| --- | --- | --- |
| Theme | `dark` | One of `light`, `dark`, `dim`. |
| Accent colour | `#6366f1` | Used for links, focus rings, the PDF title rule, and selection highlights. Any hex colour. |
| UI font | system | Font family for the chrome (sidebar, toolbar, status bar). |
| Editor font | system mono | Font family for the editor and code blocks. |
| Mono font | system mono | Font family for fenced code in preview and exports. |
| Editor font size | `15` | Pixels. |
| Editor line height | `1.7` | Unitless multiplier. |
| Editor max width | `780` | Pixels. Caps the readable column width inside the editor. |
| Code font size | `13` | Pixels. Applied to `<pre>` and `<code>` in preview/export. |

## Editor

| Setting | Default | Description |
| --- | --- | --- |
| Default editor mode | `edit` | One of `edit`, `preview`, `split`. Applied when a note is opened. |
| Show formatting toolbar | `true` | When `false`, the toolbar is hidden entirely (shortcuts still work). |
| Toolbar position | `top` | One of `top`, `bottom`. Where the formatting toolbar renders relative to the editor. |
| Show line numbers | `false` | Adds a gutter with line numbers to the editor. |
| Show invisibles | `false` | Renders spaces, tabs, and end-of-line markers as faint glyphs. |
| Soft wrap | `true` | Wrap long lines at the column edge. |
| Spell check | `true` | Use the OS spell-checker on the textarea. |
| Sticky headings | `true` | Pin the current section heading to the top while scrolling. |
| Code blocks: show line numbers | `true` | Numbers inside fenced code blocks. |
| Code blocks: wrap lines | `false` | Wrap long lines in fenced code blocks instead of horizontal scroll. |

## Files

| Setting | Default | Description |
| --- | --- | --- |
| Default note folder | _(none)_ | Where **Mod + N** creates new notes. Path relative to the vault root. Auto-created if missing. |
| Attachments folder | `attachments/` | Where pasted images and dropped files are saved. Path relative to the vault root. |
| Date format | `YYYY-MM-DD` | Used by `:date` snippet and daily-note filenames. |
| Time format | `HH:mm` | Used by `:time` snippet. |
| Daily note folder | `Daily/` | Where daily notes are created. |
| Daily note template | `Templates/daily.md` | Path to the template file used when creating a new daily note. |

## Behaviour

| Setting | Default | Description |
| --- | --- | --- |
| Autosave | `true` | Automatically save after typing pauses. |
| Autosave delay (ms) | `500` | How long to wait after the last keystroke before autosaving. |
| Confirm before delete | `true` | Ask before moving a note to trash. |
| Jump to top on open | `false` | When a note is opened, scroll to the top instead of restoring the last cursor position. |
| Restore last note | `true` | On vault re-open, restore the note you had active when you closed Trevor. |
| External-change banner | `true` | Show a banner when an external program edits the active note on disk. |

## Search

| Setting | Default | Description |
| --- | --- | --- |
| Index note bodies | `true` | Required for full-text search in the command palette. Disabling speeds up vault open for very large vaults but limits search to titles and tags. |
| Min query length | `2` | Don't run content search until the query is at least this long. |
| Max content matches | `30` | Cap on snippets surfaced in the palette. |

## Snippets

User-defined snippets are stored as a list of `{trigger, body}` pairs. Use the **+ Add snippet** button in Settings → Snippets. Built-in snippets ship with sensible defaults and can be overridden by defining the same trigger.

---

## Resetting settings

**Settings → About → Reset all settings** wipes the persisted config and restores defaults. Your notes are not touched.
