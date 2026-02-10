# Changelog

All notable changes to Panel Todo will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.2] - 2026-02-10

### Fixed
- **Completed todos reappearing after restart**: When signed in to Pro, checking off a todo now properly syncs the completion status to the backend. Previously, completed todos would reappear after restarting VS Code because the backend was never informed of the completion.
- **Project switching not working**: Fixed field name mismatch between extension and webview that caused project selector to always revert to the previous project.
- **README demo GIF not displaying**: Changed from relative path to absolute GitHub URL so the demo GIF displays correctly on VS Code Marketplace.

### Changed
- Todos now use soft-delete with `completed` flag instead of hard deletion, enabling proper sync state tracking.

## [1.0.1] - 2026-01-20

### Fixed
- Minor bug fixes

## [1.0.0] - 2026-01-20

### Changed
- **Production release**: First stable version
- Version bump from 0.4.0 to 1.0.0

### Notes
- All features from 0.4.0 included
- MCP server now available on npm: `panel-todo-mcp`

## [0.4.0] - 2026-01-09

### Added
- **Tag Management**: Create, edit, and delete tags with preset color palette (Microsoft Planner-style UI)
- **Tag Filtering**: Filter issues and kanban by tag from inline dropdown
- **Priority Filtering**: Filter issues and kanban by priority level
- **Tags Toggle**: Show/hide tag badges on issues with one click
- **Contrast-aware Tags**: Tag text automatically adjusts to black/white based on background brightness
- **Kanban Filters**: Same filter controls appear in both Issues list and Kanban board, synced together
- **Backend Tag Service**: Full CRUD for tags with issue associations
- **MCP Tag Tools**: `panelTodo_listTags`, `panelTodo_createTag`, `panelTodo_updateTag`, `panelTodo_deleteTag`, `panelTodo_addTagToIssue`, `panelTodo_removeTagFromIssue`

### Changed
- Tags now display as pill badges with names (previously just colored dots)
- Filter bar merged into sprint tabs row for compact layout
- Reduced padding on main tabs and sprint tabs for denser UI
- Sprint tabs now horizontally scroll when there are many sprints

### Fixed
- MCP `startSprint` returning empty JSON body error
- MCP `removeTagFromIssue` returning 404 after successful removal
- Backend `execute()` helper for DELETE/UPDATE queries returning proper rowCount
- Project ID sync between VS Code extension and MCP server

## [0.3.0] - 2026-01-05

### Added
- **Inline editing**: Click any todo text to edit it in place. Press Enter to save, Escape to cancel.
- **Undo delete**: When you complete (delete) a todo, an undo bar appears for 5 seconds. Click "Undo" or press `Cmd+Shift+Z` (Mac) / `Ctrl+Shift+Z` (Windows/Linux) to restore it.
- **Todo count badge**: Panel tab now shows a badge with the number of active todos.
- New command: `Panel Todo: Undo Delete`

### Changed
- Improved accessibility with ARIA labels on checkboxes

## [0.2.0] - 2026-01-04

### Added
- **Selection-to-todo command**: Select text and press `Cmd+Shift+T` (Mac) or `Ctrl+Shift+T` (Windows/Linux) to add it as a todo
- **Export as prompt block**: Press `Cmd+Shift+E` (Mac) or `Ctrl+Shift+E` (Windows/Linux) to copy all todos as a formatted prompt block for AI assistants
- **Focus input shortcut**: Press `Cmd+Shift+I` (Mac) or `Ctrl+Shift+I` (Windows/Linux) to quickly focus the todo input field
- **Editor context menu**: Right-click selected text → "Add Selection as Todo"
- Commands available in Command Palette:
  - `Panel Todo: Add Selection as Todo`
  - `Panel Todo: Export as Prompt Block`
  - `Panel Todo: Focus Input`

### Changed
- Improved description to highlight AI-assisted coding workflow
- Added marketplace metadata (keywords, repository, license)

## [0.1.0] - 2025-01-04

### Added
- Initial release
- Panel view in VS Code (alongside Terminal/Problems)
- Inline add with Enter key
- Checkbox complete with immediate removal
- Per-workspace persistence using VS Code workspaceState
- Works fully offline with zero network calls
- VS Code theme integration (light/dark mode support)
- Empty state message when no todos
- Strict Content Security Policy for webview

### Technical
- WebviewViewProvider architecture
- Message-based communication between webview and extension host
- Unique ID generation for todo items

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| 1.0.2 | 2026-02-10 | Fix completed todos reappearing, project switching, README GIF |
| 1.0.1 | 2026-01-20 | Minor bug fixes |
| 1.0.0 | 2026-01-20 | Production release, MCP server on npm |
| 0.4.0 | 2026-01-09 | Tag management, filtering, compact UI |
| 0.3.0 | 2026-01-05 | Inline editing, undo delete, todo count badge |
| 0.2.0 | 2026-01-04 | Selection-to-todo, export as prompt, keyboard shortcuts |
| 0.1.0 | 2025-01-04 | Initial release with core functionality |

---

## Upgrade Notes

### Upgrading to 0.1.0
This is the initial release. No upgrade steps required.

---

## Links

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=IngimarEyfjord.panel-todo)
- [GitHub Repository](https://github.com/ingimar-eyfjord/panel-todo)
- [Documentation](https://panel-todo.com)
