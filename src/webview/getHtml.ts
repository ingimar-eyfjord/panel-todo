import * as vscode from 'vscode';
import { getNonce } from '../utils';
import { CONFIG } from '../types';

/**
 * Generate the HTML content for the webview
 * This is a large function containing all the webview UI (HTML, CSS, JS)
 */
export function getHtml(webview: vscode.Webview): string {
  const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Todo</title>
  <style>
    :root {
      color-scheme: light dark;
    }

    body {
      background: var(--vscode-panel-background, var(--vscode-editor-background));
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      margin: 0;
      padding: 12px;
    }

    .container {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .button {
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 6px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      font-weight: 600;
      cursor: pointer;
      padding: 6px 10px;
      font-size: 0.9em;
    }

    .button.secondary {
      background: transparent;
      color: var(--vscode-foreground);
      border: 1px solid var(--vscode-input-border);
    }

    .button:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .button.secondary:hover {
      background: var(--vscode-input-background);
    }

    .auth-pending {
      display: none;
      flex-direction: column;
      gap: 6px;
      padding: 8px 10px;
      border: 1px dashed var(--vscode-input-border);
      border-radius: 6px;
      font-size: 0.9em;
    }

    .auth-pending.visible {
      display: flex;
    }

    .auth-code {
      font-family: var(--vscode-editor-font-family);
      font-weight: 600;
    }

    .hidden {
      display: none;
    }

    .upgrade-prompt {
      display: none;
      align-items: stretch;
      justify-content: space-between;
      gap: 0;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: var(--vscode-panel-background, var(--vscode-editor-background));
      border-top: 1px solid var(--vscode-panel-border, var(--vscode-input-border));
      font-size: 0.8em;
      color: var(--vscode-descriptionForeground);
    }

    .upgrade-prompt.visible {
      display: flex;
    }

    .mcp-cta {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      text-decoration: none;
      color: var(--vscode-textLink-foreground);
      border-right: 1px solid var(--vscode-panel-border, var(--vscode-input-border));
      cursor: pointer;
      transition: background 0.15s;
    }

    .mcp-cta:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .mcp-icon {
      font-size: 1em;
    }

    .mcp-text {
      white-space: nowrap;
    }

    .upgrade-cta {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      flex: 1;
      justify-content: flex-end;
    }

    .upgrade-text {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .upgrade-text strong {
      color: var(--vscode-foreground);
    }

    .upgrade-desc {
      opacity: 0.8;
    }

    .upgrade-prompt .button {
      padding: 4px 10px;
      font-size: 0.85em;
    }

    /* Add bottom padding when upgrade prompt is visible */
    body.has-upgrade-prompt {
      padding-bottom: 50px;
    }

    /* Dev toolbar */
    .dev-toolbar {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: var(--vscode-statusBar-debuggingBackground, #c24a00);
      color: var(--vscode-statusBar-debuggingForeground, #fff);
      padding: 4px 8px;
      font-size: 0.75em;
      align-items: center;
      gap: 8px;
      z-index: 1000;
    }

    .dev-toolbar.visible {
      display: flex;
    }

    .dev-toolbar span {
      opacity: 0.8;
    }

    .dev-toolbar button {
      padding: 2px 6px;
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 3px;
      background: transparent;
      color: inherit;
      font-size: inherit;
      cursor: pointer;
    }

    .dev-toolbar button:hover {
      background: rgba(255,255,255,0.1);
    }

    .dev-toolbar button.active {
      background: rgba(255,255,255,0.25);
      border-color: rgba(255,255,255,0.5);
    }

    body.has-dev-toolbar {
      padding-top: 28px;
    }

    /* Project selector */
    .project-selector {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      padding: 8px 0;
      border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-input-border));
    }

    .project-selector .project-selector-label,
    .project-selector select,
    .project-selector .project-add-btn {
      display: none;
    }

    .project-selector.has-projects .project-selector-label,
    .project-selector.has-projects select,
    .project-selector.has-projects .project-add-btn {
      display: block;
    }

    .project-selector-label {
      font-size: 0.75em;
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
    }

    .project-selector select {
      flex: 1;
      padding: 4px 8px;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 4px;
      font-size: 0.85em;
      cursor: pointer;
    }

    .project-selector select:hover {
      border-color: var(--vscode-focusBorder);
    }

    .project-selector select:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }

    .project-add-btn {
      padding: 4px 8px;
      border: 1px solid var(--vscode-input-border);
      background: transparent;
      color: var(--vscode-foreground);
      border-radius: 4px;
      font-size: 0.85em;
      cursor: pointer;
      white-space: nowrap;
    }

    .project-add-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .project-selector-right {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
    }

    .tier-badge {
      font-size: 0.7em;
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      text-transform: uppercase;
      font-weight: 600;
    }

    .tier-badge.pro {
      background: #f59e0b;
      color: #000;
    }

    .button.small {
      padding: 2px 8px;
      font-size: 0.75em;
    }

    /* Project create dialog (inline) */
    .project-create-dialog {
      display: none;
      margin-bottom: 12px;
    }

    .project-create-dialog.visible {
      display: block;
    }

    .project-create-row {
      display: flex;
      gap: 8px;
      align-items: flex-end;
    }

    .project-field {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .project-field:first-child {
      flex: 1;
    }

    .project-field.prefix {
      width: 60px;
    }

    .project-field label {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
    }

    .project-create-dialog .project-key-input {
      text-transform: uppercase;
      text-align: center;
    }

    .project-create-row .button {
      height: 24px;
      padding: 0 10px;
      font-size: 12px;
    }

    /* Tab bar */
    .tab-bar {
      display: none;
      gap: 4px;
      margin-bottom: 6px;
      border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-input-border));
      padding-bottom: 4px;
    }

    .tab-bar.visible {
      display: flex;
    }

    .tab {
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      font-size: 0.9em;
    }

    .tab:hover {
      background: var(--vscode-list-hoverBackground);
      color: var(--vscode-foreground);
    }

    .tab.active {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    /* Sections */
    .section {
      display: block;
    }

    .section.hidden {
      display: none;
    }

    #issues-section {
      position: relative;
      min-height: 200px;
    }

    /* Sprint tabs */
    .sprint-tabs-container {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-input-border));
    }

    .sprint-filters {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
      margin-left: auto;
    }

    .sprint-add-btn {
      flex-shrink: 0;
      padding: 4px 8px;
      height: 28px;
      border: 1px dashed var(--vscode-input-border);
      border-radius: 4px;
      background: transparent;
      color: var(--vscode-descriptionForeground);
      font-size: 0.75em;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      white-space: nowrap;
    }

    .sprint-add-btn:hover {
      border-color: var(--vscode-focusBorder);
      color: var(--vscode-foreground);
      background: var(--vscode-list-hoverBackground);
    }

    .sprint-tabs {
      display: flex;
      gap: 4px;
      overflow-x: auto;
      flex: 1;
      scrollbar-width: thin;
    }

    .sprint-tabs::-webkit-scrollbar {
      height: 4px;
    }

    .sprint-tabs::-webkit-scrollbar-thumb {
      background: var(--vscode-scrollbarSlider-background);
      border-radius: 2px;
    }

    .sprint-tab {
      flex-shrink: 0;
      padding: 4px 10px;
      border: 1px solid transparent;
      border-radius: 4px;
      background: transparent;
      color: var(--vscode-descriptionForeground);
      font-size: 0.8em;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;
    }

    .sprint-tab:hover {
      background: var(--vscode-list-hoverBackground);
      color: var(--vscode-foreground);
    }

    .sprint-tab.active {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .sprint-tab.drag-over {
      border-color: var(--vscode-focusBorder);
      background: var(--vscode-list-activeSelectionBackground);
      transform: scale(1.05);
    }

    .done-tab-btn {
      flex-shrink: 0;
      padding: 3px 8px;
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      background: transparent;
      color: var(--vscode-descriptionForeground);
      font-size: 0.75em;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      gap: 3px;
    }

    .done-tab-btn:hover {
      background: var(--vscode-list-hoverBackground);
      color: var(--vscode-foreground);
    }

    .done-tab-btn.active {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .done-tab-btn .done-icon {
      font-size: 0.9em;
    }

    /* Filter elements (inline with sprints) */
    .filter-toggle {
      display: flex;
      align-items: center;
      gap: 3px;
      padding: 3px 8px;
      border: 1px solid var(--vscode-input-border);
      background: transparent;
      color: var(--vscode-descriptionForeground);
      border-radius: 4px;
      font-size: 0.75em;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    }

    .filter-toggle:hover {
      border-color: var(--vscode-focusBorder);
      color: var(--vscode-foreground);
    }

    .filter-toggle.active {
      background: var(--vscode-button-secondaryBackground);
      border-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    .filter-toggle .toggle-icon {
      font-size: 10px;
    }

    .filter-select {
      padding: 3px 6px;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 4px;
      font-size: 0.75em;
      cursor: pointer;
      min-width: 80px;
    }

    .filter-select:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }

    .filter-select.has-filter {
      border-color: var(--vscode-button-background);
      background: var(--vscode-button-secondaryBackground);
    }

    /* Hide elements when viewing Done tab */
    .viewing-done .sprint-add-btn,
    .viewing-done .sprint-create,
    .viewing-done .issue-input-row,
    .viewing-done #backlog-section {
      display: none !important;
    }

    .sprint-create {
      display: none;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }

    .sprint-create.visible {
      display: flex;
    }

    .sprint-create input {
      width: 120px;
      padding: 4px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-focusBorder);
      border-radius: 4px;
      font-size: 0.85em;
    }

    .sprint-create-btn {
      width: 24px;
      height: 24px;
      border: none;
      border-radius: 4px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .sprint-create-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    /* Backlog section within sprint view */
    .backlog-section {
      margin-top: 16px;
    }

    .backlog-section.hidden {
      display: none;
    }

    .backlog-divider {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      opacity: 0.6;
    }

    .backlog-divider-line {
      flex: 1;
      height: 1px;
      background: var(--vscode-panel-border);
    }

    .backlog-divider-text {
      font-size: 0.75em;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
    }

    .backlog-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      cursor: pointer;
      user-select: none;
    }

    .backlog-header:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .backlog-title {
      font-weight: 600;
      font-size: 0.85em;
      flex: 1;
    }

    .backlog-count {
      font-size: 0.8em;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 2px 6px;
      border-radius: 10px;
    }

    .backlog-expand-icon {
      font-size: 14px;
      color: var(--vscode-descriptionForeground);
      transition: transform 0.2s;
    }

    .backlog-section.expanded .backlog-expand-icon {
      transform: rotate(45deg);
    }

    .backlog-items {
      display: none;
      flex-direction: column;
      gap: 4px;
      margin-top: 8px;
      padding: 8px;
      border: 1px dashed var(--vscode-panel-border);
      border-radius: 6px;
      min-height: 40px;
    }

    .backlog-section.expanded .backlog-items {
      display: flex;
    }

    .backlog-items.drag-over {
      border-color: var(--vscode-focusBorder);
      background: var(--vscode-list-hoverBackground);
    }

    .backlog-items .issue-item {
      opacity: 0.8;
    }

    .backlog-items .issue-item:hover {
      opacity: 1;
    }

    .empty-backlog {
      text-align: center;
      color: var(--vscode-descriptionForeground);
      font-size: 0.85em;
      padding: 8px;
    }

    /* Context Menu */
    .context-menu {
      display: none;
      position: fixed;
      z-index: 1000;
      min-width: 150px;
      background: var(--vscode-menu-background);
      border: 1px solid var(--vscode-menu-border);
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      padding: 4px 0;
    }

    .context-menu.visible {
      display: block;
    }

    .context-menu-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      cursor: pointer;
      font-size: 0.9em;
      color: var(--vscode-menu-foreground);
    }

    .context-menu-item:hover {
      background: var(--vscode-menu-selectionBackground);
      color: var(--vscode-menu-selectionForeground);
    }

    .context-menu-item.danger {
      color: var(--vscode-errorForeground);
    }

    .context-menu-item.danger:hover {
      background: var(--vscode-inputValidation-errorBackground);
    }

    .context-menu-separator {
      height: 1px;
      background: var(--vscode-menu-separatorBackground);
      margin: 4px 0;
    }

    /* Dialog Overlay */
    .dialog-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1001;
      align-items: center;
      justify-content: center;
    }

    .dialog-overlay.visible {
      display: flex;
    }

    .dialog {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 16px;
      min-width: 300px;
      max-width: 400px;
    }

    .dialog-title {
      font-weight: 600;
      font-size: 1.1em;
      margin-bottom: 12px;
    }

    .dialog-message {
      color: var(--vscode-descriptionForeground);
      margin-bottom: 16px;
      line-height: 1.4;
    }

    .dialog-input {
      width: 100%;
      padding: 8px;
      margin-bottom: 16px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
    }

    .dialog-input:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }

    .dialog-options {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }

    .dialog-option {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      cursor: pointer;
    }

    .dialog-option:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .dialog-option.selected {
      border-color: var(--vscode-focusBorder);
      background: var(--vscode-list-activeSelectionBackground);
    }

    .dialog-option input[type="radio"] {
      margin: 0;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .button.small {
      padding: 4px 8px;
      font-size: 0.85em;
    }

    /* Issue input row */
    .issue-input-row {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }

    .issue-input-row input {
      flex: 1;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 6px;
      padding: 8px 10px;
    }

    .issue-input-row input:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }

    .issue-priority-select {
      padding: 6px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 6px;
      font-size: 0.85em;
    }

    .issue-add-btn {
      width: 36px;
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 6px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      font-weight: 600;
      cursor: pointer;
    }

    .issue-add-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    /* Issues list */
    .issues-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .issue-group {
      border: 1px solid var(--vscode-panel-border, var(--vscode-input-border));
      border-radius: 6px;
      overflow: hidden;
    }

    .issue-group-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 10px;
      background: var(--vscode-editorWidget-background);
      cursor: pointer;
      user-select: none;
    }

    .issue-group-header:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .issue-group-title {
      font-weight: 600;
      font-size: 0.85em;
    }

    .issue-group-count {
      font-size: 0.8em;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 2px 6px;
      border-radius: 10px;
      min-width: 18px;
      text-align: center;
    }

    .issue-group-items {
      display: flex;
      flex-direction: column;
    }

    .issue-group.collapsed .issue-group-items {
      display: none;
    }

    .issue-group.collapsed .issue-group-header::before {
      content: "";
    }

    /* Issue item */
    .issue-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 8px 10px;
      border-top: 1px solid var(--vscode-panel-border, var(--vscode-input-border));
      cursor: pointer;
    }

    .issue-item:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .issue-key {
      font-family: var(--vscode-editor-font-family);
      font-size: 0.8em;
      color: var(--vscode-textLink-foreground);
      white-space: nowrap;
    }

    .issue-title {
      flex: 1;
      font-size: 0.9em;
      line-height: 1.3;
    }

    .issue-priority {
      font-size: 0.7em;
      padding: 2px 5px;
      border-radius: 3px;
      text-transform: uppercase;
      font-weight: 600;
    }

    .issue-priority.critical {
      background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
      color: var(--vscode-inputValidation-errorForeground, #f88);
    }

    .issue-priority.high {
      background: var(--vscode-inputValidation-warningBackground, #4d3a1a);
      color: var(--vscode-inputValidation-warningForeground, #fa3);
    }

    .issue-priority.medium {
      background: var(--vscode-inputValidation-infoBackground, #1a3a4d);
      color: var(--vscode-inputValidation-infoForeground, #3af);
    }

    .issue-priority.low {
      background: var(--vscode-editor-background);
      color: var(--vscode-descriptionForeground);
    }

    /* Tag Badges */
    .issue-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin: 0 8px;
      max-width: 200px;
    }

    .tag-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 500;
      max-width: 80px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tag-badge-remove {
      margin-left: 4px;
      cursor: pointer;
      opacity: 0.7;
      background: none;
      border: none;
      color: inherit;
      font-size: 12px;
      padding: 0;
      line-height: 1;
    }

    .tag-badge-remove:hover {
      opacity: 1;
    }

    /* Tag badges on issue items */
    .issue-item-tags {
      display: flex;
      gap: 4px;
      margin-left: auto;
      margin-right: 8px;
      flex-shrink: 0;
      align-items: center;
    }

    .issue-item-tag {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 500;
      max-width: 70px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .issue-item-tags-overflow {
      font-size: 9px;
      color: var(--vscode-descriptionForeground);
      margin-left: 2px;
    }

    .tag-dropdown-item {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      cursor: pointer;
      border-radius: 4px;
      gap: 10px;
      transition: background 0.1s;
    }

    .tag-dropdown-item:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .tag-color-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      flex-shrink: 0;
      box-shadow: 0 1px 2px rgba(0,0,0,0.15);
    }

    .tag-dropdown-name {
      flex: 1;
      font-size: 12px;
    }

    /* Quick tag dropdown on issue items */
    .quick-tag-container {
      position: relative;
      flex-shrink: 0;
    }

    .quick-tag-btn {
      width: 20px;
      height: 20px;
      border: 1px dashed var(--vscode-input-border);
      border-radius: 4px;
      background: transparent;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.6;
      transition: all 0.15s;
    }

    .quick-tag-btn:hover {
      opacity: 1;
      border-color: var(--vscode-focusBorder);
      color: var(--vscode-foreground);
    }

    .quick-tag-popover {
      position: fixed;
      z-index: 10000;
      min-width: 160px;
      max-height: 200px;
      overflow-y: auto;
      background: var(--vscode-dropdown-background);
      border: 1px solid var(--vscode-dropdown-border);
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      padding: 4px;
      display: none;
    }

    .quick-tag-popover.visible {
      display: block;
    }

    .quick-tag-option {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
    }

    .quick-tag-option:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .quick-tag-option.selected {
      background: var(--vscode-list-activeSelectionBackground);
    }

    .quick-tag-option .tag-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .quick-tag-option .tag-check {
      margin-left: auto;
      font-size: 10px;
      color: var(--vscode-foreground);
    }

    .quick-tag-empty {
      padding: 8px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
    }

    /* Tag Management Dialog - Microsoft Todo/Planner inspired */
    .tag-management {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 300;
      justify-content: center;
      align-items: center;
    }

    .tag-management.visible {
      display: flex;
    }

    .tag-management-dialog {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border);
      border-radius: 12px;
      padding: 0;
      min-width: 340px;
      max-width: 420px;
      max-height: 80vh;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    }

    .tag-dialog-header {
      padding: 20px 24px 16px;
      border-bottom: 1px solid var(--vscode-widget-border);
    }

    .tag-dialog-header h2 {
      margin: 0 0 4px;
      font-size: 16px;
      font-weight: 600;
    }

    .tag-dialog-header p {
      margin: 0;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }

    .tag-list {
      max-height: 280px;
      overflow-y: auto;
      padding: 8px 0;
    }

    .tag-list-item {
      display: flex;
      align-items: center;
      padding: 10px 24px;
      gap: 12px;
      transition: background 0.1s;
    }

    .tag-list-item:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .tag-list-item-color {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      flex-shrink: 0;
      box-shadow: inset 0 0 0 1px rgba(0,0,0,0.1);
    }

    .tag-list-item-info {
      flex: 1;
      min-width: 0;
    }

    .tag-list-item-name {
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .tag-list-item-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.15s;
    }

    .tag-list-item:hover .tag-list-item-actions {
      opacity: 1;
    }

    .tag-list-item-actions button {
      padding: 6px;
      background: transparent;
      border: none;
      color: var(--vscode-foreground);
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      opacity: 0.7;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .tag-list-item-actions button:hover {
      background: var(--vscode-toolbar-hoverBackground);
      opacity: 1;
    }

    .tag-edit-color {
      width: 28px;
      height: 28px;
      padding: 0;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      opacity: 0;
      position: absolute;
    }

    .tag-color-wrapper {
      position: relative;
      cursor: pointer;
    }

    .tag-color-wrapper:hover .tag-list-item-color {
      box-shadow: inset 0 0 0 2px var(--vscode-focusBorder);
    }

    .tag-list-empty {
      padding: 32px 24px;
      color: var(--vscode-descriptionForeground);
      text-align: center;
      font-size: 13px;
    }

    .tag-list-empty-icon {
      font-size: 32px;
      margin-bottom: 8px;
      opacity: 0.5;
    }

    .tag-create-section {
      padding: 16px 24px;
      border-top: 1px solid var(--vscode-widget-border);
      background: var(--vscode-sideBar-background);
    }

    .tag-create-section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 12px;
    }

    .tag-create-form {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .tag-create-form input[type="text"] {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 6px;
      font-size: 13px;
    }

    .tag-create-form input[type="text"]:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }

    .tag-color-picker-wrapper {
      position: relative;
    }

    .tag-color-preview {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      cursor: pointer;
      box-shadow: inset 0 0 0 1px rgba(0,0,0,0.1);
      transition: transform 0.1s;
    }

    .tag-color-preview:hover {
      transform: scale(1.05);
    }

    .tag-color-picker {
      position: absolute;
      top: 0;
      left: 0;
      width: 36px;
      height: 36px;
      opacity: 0;
      cursor: pointer;
    }

    .tag-preset-colors {
      display: flex;
      gap: 6px;
      margin-top: 10px;
      flex-wrap: wrap;
    }

    .tag-preset-color {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      cursor: pointer;
      border: 2px solid transparent;
      transition: transform 0.1s, border-color 0.1s;
      box-shadow: 0 1px 3px rgba(0,0,0,0.15);
    }

    .tag-preset-color:hover {
      transform: scale(1.15);
    }

    .tag-preset-color.selected {
      border-color: var(--vscode-focusBorder);
    }

    .tag-dialog-footer {
      padding: 12px 24px 16px;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      border-top: 1px solid var(--vscode-widget-border);
    }

    .tag-management-close {
      padding: 8px 20px;
      border-radius: 6px;
    }

    /* Detail Tags */
    .detail-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: flex-start;
    }

    .detail-tags .issue-tags {
      max-width: none;
      margin: 0;
    }

    .add-tag-btn {
      padding: 4px 10px;
      border: 1px dashed var(--vscode-input-border);
      background: transparent;
      color: var(--vscode-descriptionForeground);
      border-radius: 12px;
      font-size: 11px;
      cursor: pointer;
    }

    .add-tag-btn:hover {
      border-color: var(--vscode-focusBorder);
      color: var(--vscode-foreground);
    }

    .tag-selector {
      position: relative;
    }

    .tag-dropdown {
      display: none;
      position: absolute;
      top: 100%;
      left: 0;
      margin-top: 4px;
      background: var(--vscode-dropdown-background);
      border: 1px solid var(--vscode-dropdown-border);
      border-radius: 4px;
      padding: 4px;
      z-index: 200;
      max-height: 200px;
      overflow-y: auto;
      min-width: 150px;
    }

    .tag-dropdown.visible {
      display: block;
    }

    .tag-dropdown-empty {
      padding: 8px;
      color: var(--vscode-descriptionForeground);
      font-style: italic;
    }

    .manage-tags-btn {
      width: 100%;
      padding: 6px 8px;
      margin-top: 4px;
      background: transparent;
      border: 1px solid var(--vscode-input-border);
      color: var(--vscode-foreground);
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
    }

    .manage-tags-btn:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .tag-list-empty {
      padding: 12px;
      color: var(--vscode-descriptionForeground);
      text-align: center;
      font-style: italic;
    }

    .tag-list-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-left: auto;
    }

    .tag-edit-color {
      width: 24px;
      height: 24px;
      padding: 0;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .tag-delete-btn {
      padding: 2px 6px;
      background: transparent;
      border: none;
      cursor: pointer;
      opacity: 0.7;
    }

    .tag-delete-btn:hover {
      opacity: 1;
    }

    .tag-color-picker {
      width: 32px;
      height: 32px;
      padding: 0;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    /* Drag and Drop */
    .issue-item[draggable="true"] {
      cursor: grab;
    }

    .issue-item[draggable="true"]:active {
      cursor: grabbing;
    }

    .issue-item.dragging {
      opacity: 0.5;
      background: var(--vscode-list-activeSelectionBackground);
    }

    .issue-group.drag-over {
      background: var(--vscode-list-hoverBackground);
    }

    .issue-group.drag-over .issue-group-header {
      background: var(--vscode-list-activeSelectionBackground);
    }

    .issue-group-items.drag-over {
      min-height: 40px;
      border: 2px dashed var(--vscode-focusBorder);
      border-radius: 4px;
      margin: 4px;
    }

    /* Kanban Sprint Tabs */
    .kanban-sprint-tabs-container {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 0;
      margin-bottom: 6px;
      border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-input-border));
    }

    /* Kanban Board */
    .kanban-board {
      display: flex;
      gap: 8px;
      height: calc(100vh - 160px);
      overflow-x: auto;
      padding-bottom: 8px;
    }

    .kanban-column {
      flex: 1;
      min-width: 180px;
      max-width: 280px;
      display: flex;
      flex-direction: column;
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border, var(--vscode-input-border));
      border-radius: 6px;
      overflow: hidden;
    }

    .kanban-column-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 10px;
      background: var(--vscode-sideBarSectionHeader-background);
      border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-input-border));
      font-size: 0.85em;
      font-weight: 600;
    }

    .kanban-column-title {
      color: var(--vscode-foreground);
    }

    .kanban-column-count {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 1px 6px;
      border-radius: 10px;
      font-size: 0.8em;
      font-weight: normal;
    }

    .kanban-column-items {
      flex: 1;
      overflow-y: auto;
      padding: 6px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .kanban-column-items:empty::after {
      content: "No items";
      color: var(--vscode-descriptionForeground);
      font-size: 0.8em;
      text-align: center;
      padding: 20px;
      font-style: italic;
    }

    .kanban-card {
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      padding: 8px;
      cursor: grab;
      transition: all 0.15s ease;
    }

    .kanban-card:hover {
      border-color: var(--vscode-focusBorder);
      background: var(--vscode-list-hoverBackground);
    }

    .kanban-card:active {
      cursor: grabbing;
    }

    .kanban-card.dragging {
      opacity: 0.5;
      transform: rotate(2deg);
    }

    .kanban-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }

    .kanban-card-key {
      font-size: 0.75em;
      color: var(--vscode-descriptionForeground);
    }

    .kanban-card-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.15s ease;
    }

    .kanban-card:hover .kanban-card-actions {
      opacity: 1;
    }

    .kanban-card-edit {
      background: none;
      border: none;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      padding: 2px 4px;
      font-size: 0.75em;
      border-radius: 3px;
      transition: background 0.15s ease;
    }

    .kanban-card-edit:hover {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-foreground);
    }

    .kanban-card-title {
      font-size: 0.85em;
      color: var(--vscode-foreground);
      margin-bottom: 6px;
      line-height: 1.3;
    }

    .kanban-card-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .kanban-card-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 6px;
    }

    .kanban-card-tag {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 9px;
      font-weight: 500;
      max-width: 60px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .kanban-card-tags-more {
      font-size: 9px;
      color: var(--vscode-descriptionForeground);
      padding: 2px 4px;
    }

    .kanban-card-priority {
      font-size: 0.7em;
      padding: 1px 5px;
      border-radius: 3px;
      text-transform: uppercase;
      font-weight: 500;
    }

    .kanban-card-priority.critical {
      background: var(--vscode-inputValidation-errorBackground, #4d1a1a);
      color: var(--vscode-inputValidation-errorForeground, #f55);
    }

    .kanban-card-priority.high {
      background: var(--vscode-inputValidation-warningBackground, #4d3a1a);
      color: var(--vscode-inputValidation-warningForeground, #fa3);
    }

    .kanban-card-priority.medium {
      background: var(--vscode-inputValidation-infoBackground, #1a3a4d);
      color: var(--vscode-inputValidation-infoForeground, #3af);
    }

    .kanban-card-priority.low {
      background: var(--vscode-editor-background);
      color: var(--vscode-descriptionForeground);
    }

    .kanban-card-sprint {
      font-size: 0.7em;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-button-secondaryBackground);
      padding: 1px 5px;
      border-radius: 3px;
    }

    .kanban-column.drag-over {
      background: var(--vscode-list-hoverBackground);
    }

    .kanban-column.drag-over .kanban-column-items {
      background: var(--vscode-list-activeSelectionBackground);
      min-height: 60px;
    }

    /* Issue Detail Panel */
    .issue-detail {
      display: none;
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--vscode-editor-background);
      flex-direction: column;
      z-index: 100;
    }

    .issue-detail.visible {
      display: flex;
    }

    .issue-detail-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-input-border));
    }

    .detail-key {
      font-family: var(--vscode-editor-font-family);
      font-weight: 600;
      color: var(--vscode-textLink-foreground);
    }

    .detail-close {
      background: transparent;
      border: none;
      color: var(--vscode-foreground);
      font-size: 20px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
    }

    .detail-close:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .issue-detail-body {
      flex: 1;
      padding: 12px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .detail-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .detail-field label {
      font-size: 0.8em;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
    }

    .detail-field input,
    .detail-field textarea,
    .detail-field select {
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      padding: 8px;
      font-family: inherit;
      font-size: inherit;
    }

    .detail-field input:focus,
    .detail-field textarea:focus,
    .detail-field select:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }

    .detail-field textarea {
      resize: vertical;
      min-height: 80px;
    }

    .detail-row {
      display: flex;
      gap: 12px;
    }

    .detail-field.half {
      flex: 1;
    }

    .issue-detail-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      border-top: 1px solid var(--vscode-panel-border, var(--vscode-input-border));
    }

    .detail-actions {
      display: flex;
      gap: 8px;
    }

    /* Comments section */
    .detail-comments {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--vscode-panel-border, var(--vscode-input-border));
    }

    .detail-comments label {
      display: block;
      margin-bottom: 8px;
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
    }

    .comments-list {
      max-height: 150px;
      overflow-y: auto;
      margin-bottom: 8px;
    }

    .comments-empty,
    .comments-loading {
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
      padding: 8px 0;
    }

    .comment {
      padding: 8px;
      margin-bottom: 6px;
      background: var(--vscode-input-background);
      border-radius: 4px;
      border: 1px solid var(--vscode-input-border);
    }

    .comment-content {
      font-size: 0.9em;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .comment-time {
      font-size: 0.75em;
      color: var(--vscode-descriptionForeground);
      margin-top: 4px;
    }

    .comment-input-row {
      display: flex;
      gap: 6px;
    }

    .comment-input-row input {
      flex: 1;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      padding: 6px 8px;
      font-size: 0.9em;
    }

    .comment-input-row input:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }

    .button.danger {
      background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
      color: var(--vscode-inputValidation-errorForeground, #f88);
      border-color: var(--vscode-inputValidation-errorBorder, #be1100);
    }

    .button.danger:hover {
      background: var(--vscode-inputValidation-errorBorder, #be1100);
    }

    /* Account Section */
    .account-section {
      padding: 8px 0;
    }

    .account-header {
      margin-bottom: 16px;
      font-size: 1em;
      font-weight: 600;
    }

    .account-field {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-input-border));
    }

    .account-field label {
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
    }

    .account-field span {
      font-weight: 500;
    }

    .tier-badge {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.8em;
      font-weight: 600;
    }

    .tier-badge.pro {
      background: rgba(255, 193, 7, 0.15);
      color: #ffc107;
    }

    .tier-badge.team {
      background: rgba(156, 39, 176, 0.15);
      color: #ce93d8;
    }

    .offline-indicator {
      display: none;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75em;
      font-weight: 500;
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
    }

    .offline-indicator.visible {
      display: inline-block;
    }

    .sync-indicator {
      display: none;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75em;
      font-weight: 500;
      background: rgba(59, 130, 246, 0.15);
      color: #3b82f6;
    }

    .sync-indicator.visible {
      display: inline-flex;
    }

    .sync-spinner {
      width: 10px;
      height: 10px;
      border: 2px solid rgba(59, 130, 246, 0.3);
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Conflict Resolution UI */
    .conflicts-banner {
      display: none;
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 12px;
    }

    .conflicts-banner.visible {
      display: block;
    }

    .conflicts-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .conflicts-title {
      font-weight: 600;
      color: #f59e0b;
      font-size: 0.9em;
    }

    .conflicts-actions {
      display: flex;
      gap: 8px;
    }

    .conflict-item {
      background: var(--vscode-input-background);
      border-radius: 4px;
      padding: 10px;
      margin-bottom: 8px;
    }

    .conflict-item:last-child {
      margin-bottom: 0;
    }

    .conflict-label {
      font-size: 0.75em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .conflict-text {
      font-size: 0.9em;
      margin-bottom: 8px;
      padding: 6px 8px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 3px;
    }

    .conflict-text.local {
      border-left: 3px solid #3b82f6;
    }

    .conflict-text.remote {
      border-left: 3px solid #10b981;
    }

    .conflict-buttons {
      display: flex;
      gap: 6px;
      margin-top: 8px;
    }

    .conflict-btn {
      padding: 4px 10px;
      font-size: 0.8em;
      border-radius: 4px;
      border: none;
      cursor: pointer;
      transition: background 0.15s;
    }

    .conflict-btn.local {
      background: rgba(59, 130, 246, 0.2);
      color: #3b82f6;
    }

    .conflict-btn.local:hover {
      background: rgba(59, 130, 246, 0.3);
    }

    .conflict-btn.remote {
      background: rgba(16, 185, 129, 0.2);
      color: #10b981;
    }

    .conflict-btn.remote:hover {
      background: rgba(16, 185, 129, 0.3);
    }

    .conflict-btn.both {
      background: rgba(139, 92, 246, 0.2);
      color: #8b5cf6;
    }

    .conflict-btn.both:hover {
      background: rgba(139, 92, 246, 0.3);
    }

    .account-section-title {
      margin-top: 20px;
      margin-bottom: 10px;
      font-size: 0.75em;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      letter-spacing: 0.5px;
    }

    .account-action {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      margin-bottom: 8px;
      border: 1px solid var(--vscode-input-border);
      border-radius: 6px;
    }

    .account-action .action-info {
      flex: 1;
    }

    .account-action .action-info strong {
      display: block;
      margin-bottom: 2px;
    }

    .account-action .action-info p {
      margin: 0;
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
    }

    .account-action.danger-zone {
      border-color: var(--vscode-inputValidation-errorBorder, #be1100);
    }

    .account-links {
      margin-top: 20px;
      display: flex;
      gap: 16px;
    }

    .account-links a {
      color: var(--vscode-textLink-foreground);
      font-size: 0.85em;
      text-decoration: none;
      cursor: pointer;
    }

    .account-links a:hover {
      text-decoration: underline;
    }

    /* MCP Tokens Section */
    .mcp-tokens-list {
      margin-bottom: 12px;
    }

    .mcp-token-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      margin-bottom: 6px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 6px;
    }

    .mcp-token-info {
      flex: 1;
    }

    .mcp-token-name {
      font-weight: 500;
      margin-bottom: 2px;
    }

    .mcp-token-meta {
      font-size: 0.8em;
      color: var(--vscode-descriptionForeground);
    }

    .mcp-token-revoke {
      padding: 4px 8px;
      font-size: 0.8em;
      background: transparent;
      color: var(--vscode-errorForeground, #f14c4c);
      border: 1px solid var(--vscode-errorForeground, #f14c4c);
      border-radius: 4px;
      cursor: pointer;
    }

    .mcp-token-revoke:hover {
      background: rgba(241, 76, 76, 0.1);
    }

    .mcp-tokens-empty {
      padding: 12px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
      font-size: 0.9em;
      background: var(--vscode-input-background);
      border-radius: 6px;
    }

    .mcp-token-create-row {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }

    .mcp-token-create-row input {
      flex: 1;
    }

    .mcp-token-create-row button {
      flex-shrink: 0;
    }

    .mcp-token-created-banner {
      display: none;
      padding: 12px;
      margin-bottom: 12px;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 6px;
    }

    .mcp-token-created-banner.visible {
      display: block;
    }

    .mcp-token-created-title {
      font-weight: 600;
      color: #10b981;
      margin-bottom: 8px;
    }

    .mcp-token-created-value {
      font-family: var(--vscode-editor-font-family);
      font-size: 0.85em;
      padding: 8px;
      background: var(--vscode-input-background);
      border-radius: 4px;
      word-break: break-all;
      margin-bottom: 8px;
    }

    .mcp-token-created-warning {
      font-size: 0.8em;
      color: var(--vscode-descriptionForeground);
    }

    .mcp-token-created-actions {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }

    .button.loading {
      position: relative;
      pointer-events: none;
      opacity: 0.7;
    }

    /* Delete Account Dialog */
    .delete-confirm-input {
      margin-top: 12px;
    }

    .delete-confirm-input label {
      display: block;
      margin-bottom: 4px;
      font-size: 0.85em;
    }

    .delete-confirm-input input {
      width: 100%;
      padding: 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      box-sizing: border-box;
    }

    /* Send to Terminal button - Claude orange */
    .send-to-terminal-btn {
      opacity: 0;
      background: rgba(218, 119, 86, 0.15);
      border: 1px solid #DA7756;
      color: #DA7756;
      cursor: pointer;
      padding: 2px 8px;
      font-size: 0.75em;
      border-radius: 3px;
      transition: opacity 0.15s ease, background 0.15s ease;
      margin-left: auto;
      white-space: nowrap;
      font-weight: 500;
    }

    li:hover .send-to-terminal-btn,
    .issue-item:hover .send-to-terminal-btn {
      opacity: 1;
    }

    .send-to-terminal-btn:hover {
      background: #DA7756;
      color: #fff;
    }

    /* Trash Drop Zone */
    .trash-drop-zone {
      display: none;
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 24px;
      background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
      border: 2px dashed var(--vscode-inputValidation-errorBorder, #be1100);
      border-radius: 8px;
      color: var(--vscode-inputValidation-errorForeground, #f88);
      z-index: 1000;
      gap: 8px;
      align-items: center;
    }

    .trash-drop-zone.visible {
      display: flex;
    }

    .trash-drop-zone.drag-over {
      background: var(--vscode-inputValidation-errorBorder, #be1100);
      border-style: solid;
    }

    .trash-icon {
      font-size: 20px;
    }

    .trash-text {
      font-size: 13px;
      font-weight: 500;
    }

    .todos-explainer {
      font-size: 0.8em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
      margin-top: -4px;
    }

    .todos-explainer code {
      background: var(--vscode-textCodeBlock-background, rgba(127, 127, 127, 0.2));
      padding: 1px 4px;
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family);
    }

    .help-link {
      color: var(--vscode-textLink-foreground);
      text-decoration: none;
      cursor: pointer;
      margin-left: 4px;
    }

    .help-link:hover {
      text-decoration: underline;
    }

    .input-row {
      display: flex;
      gap: 8px;
    }

    #todo-input {
      flex: 1;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 6px;
      padding: 8px 10px;
    }

    #todo-input:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }

    #add-btn {
      width: 36px;
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 6px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      font-weight: 600;
      cursor: pointer;
    }

    #add-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .empty {
      color: var(--vscode-descriptionForeground);
      font-size: 0.9em;
    }

    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    li {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 6px 6px;
      border-radius: 6px;
    }

    li:hover {
      background: var(--vscode-list-hoverBackground);
    }

    label {
      flex: 1;
      line-height: 1.4;
      word-break: break-word;
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 4px;
    }

    label:hover {
      background: var(--vscode-input-background);
    }

    .edit-input {
      flex: 1;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-focusBorder);
      border-radius: 4px;
      padding: 2px 4px;
      font-family: inherit;
      font-size: inherit;
    }

    .undo-bar {
      display: none;
      padding: 8px 12px;
      background: var(--vscode-inputValidation-infoBackground);
      border: 1px solid var(--vscode-inputValidation-infoBorder);
      border-radius: 6px;
      font-size: 0.9em;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .undo-bar.visible {
      display: flex;
    }

    /* Unassigned todos section (for migrating legacy cloud todos) */
    .unassigned-section {
      display: none;
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px dashed var(--vscode-panel-border, var(--vscode-input-border));
    }

    .unassigned-section.visible {
      display: block;
    }

    .unassigned-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .unassigned-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
    }

    .unassigned-title-icon {
      font-size: 1em;
    }

    .unassigned-migrate-btn {
      padding: 4px 10px;
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      background: transparent;
      color: var(--vscode-foreground);
      font-size: 0.8em;
      cursor: pointer;
    }

    .unassigned-migrate-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
      border-color: var(--vscode-focusBorder);
    }

    .unassigned-list {
      opacity: 0.7;
    }

    .unassigned-list li {
      background: var(--vscode-input-background);
      border: 1px dashed var(--vscode-input-border);
    }

    .undo-btn {
      background: transparent;
      border: 1px solid var(--vscode-button-border, var(--vscode-foreground));
      color: var(--vscode-foreground);
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85em;
    }

    .undo-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
  </style>
</head>
<body>
  <div id="dev-toolbar" class="dev-toolbar">
    <span>DEV</span>
    <button id="dev-out" data-tier="out">Signed Out</button>
    <button id="dev-free" data-tier="free">Free</button>
    <button id="dev-pro" data-tier="pro">Pro</button>
  </div>
  <div class="container">
    <div id="auth-pending" class="auth-pending">
      <div>
        Open <span id="auth-link"></span> and enter code
        <span id="auth-code" class="auth-code"></span>
      </div>
      <div class="auth-actions">
        <button id="auth-open-btn" class="button secondary">Open</button>
        <button id="auth-copy-btn" class="button secondary">Copy code</button>
      </div>
    </div>
    <!-- Conflicts Banner -->
    <div id="conflicts-banner" class="conflicts-banner">
      <div class="conflicts-header">
        <span class="conflicts-title">Sync Conflicts</span>
        <div class="conflicts-actions">
          <button id="resolve-all-local" class="conflict-btn local">Keep All Local</button>
          <button id="resolve-all-remote" class="conflict-btn remote">Keep All Remote</button>
        </div>
      </div>
      <div id="conflicts-list"></div>
    </div>
    <!-- Project Selector (Pro only, shown when multiple projects) -->
    <div id="project-selector" class="project-selector">
      <span class="project-selector-label">Project:</span>
      <select id="project-select">
        <option value="">Loading...</option>
      </select>
      <button id="project-add-btn" class="project-add-btn" title="New Project">+ New Project</button>
      <div class="project-selector-right">
        <span id="sync-indicator" class="sync-indicator"><span class="sync-spinner"></span>Syncing</span>
        <span id="offline-indicator" class="offline-indicator">Offline</span>
        <span id="auth-status" class="tier-badge">Pro</span>
        <button id="sign-in-btn" class="button small">Sign in</button>
        <button id="sign-out-btn" class="button secondary small hidden">Sign out</button>
      </div>
    </div>
    <!-- Project Create Dialog -->
    <div id="project-create-dialog" class="project-create-dialog">
      <div class="project-create-row">
        <div class="project-field">
          <label for="project-name">Project Name</label>
          <input id="project-name" type="text" placeholder="e.g. My Project" />
        </div>
        <div class="project-field prefix">
          <label for="project-key">Prefix</label>
          <input id="project-key" type="text" placeholder="MP" class="project-key-input" maxlength="10" />
        </div>
        <button id="project-cancel-btn" class="button secondary small">Cancel</button>
        <button id="project-create-btn" class="button small">Create</button>
      </div>
    </div>
    <!-- Tab bar (Pro only) -->
    <div id="tab-bar" class="tab-bar">
      <button id="tab-todos" class="tab active" data-tab="todos">Todos</button>
      <button id="tab-issues" class="tab" data-tab="issues">Issues</button>
      <button id="tab-kanban" class="tab" data-tab="kanban">Kanban</button>
      <button id="tab-account" class="tab" data-tab="account">Account</button>
    </div>

    <!-- Todos Section -->
    <div id="todos-section" class="section">
      <div class="todos-explainer">Todos are saved in your project's <code>.vscode</code> folder <a id="todos-help-link" class="help-link">Learn more</a></div>
      <div class="input-row">
        <input id="todo-input" type="text" placeholder="Add a todo and press Enter" />
        <button id="add-btn" title="Add">+</button>
      </div>
      <div id="undo-bar" class="undo-bar">
        <span>Todo deleted</span>
        <button id="undo-btn" class="undo-btn">Undo</button>
      </div>
      <div id="empty" class="empty">No todos yet. Add one above.</div>
      <ul id="list"></ul>

      <!-- Unassigned todos (legacy cloud todos without workspace) -->
      <div id="unassigned-section" class="unassigned-section">
        <div class="unassigned-header">
          <div class="unassigned-title">
            <span class="unassigned-title-icon">📦</span>
            <span>Unassigned Todos</span>
          </div>
          <button id="migrate-btn" class="unassigned-migrate-btn">Move to workspace</button>
        </div>
        <ul id="unassigned-list" class="unassigned-list"></ul>
      </div>
    </div>

    <!-- Issues Section (Pro only) -->
    <div id="issues-section" class="section hidden">
      <!-- Sprint tabs row -->
      <div class="sprint-tabs-container">
        <button id="new-sprint-btn" class="sprint-add-btn" title="New Sprint">+ New Sprint</button>
        <!-- Inline sprint creation (replaces new-sprint-btn when visible) -->
        <div id="sprint-create" class="sprint-create hidden">
          <input id="sprint-name" type="text" placeholder="Sprint name" />
          <button id="sprint-save-btn" class="sprint-create-btn" title="Create">+</button>
        </div>
        <div id="sprint-tabs" class="sprint-tabs">
          <button class="sprint-tab active" data-sprint="">All</button>
          <button class="sprint-tab" data-sprint="__backlog__">Backlog</button>
          <!-- Dynamic sprint tabs added here -->
        </div>
        <!-- Filters and Done (pushed right by sprint-tabs flex) -->
        <div class="sprint-filters">
          <button id="tags-toggle-btn" class="filter-toggle active" title="Show/hide tags on issues">
            <span class="toggle-icon">🏷️</span>
            <span>Tags</span>
          </button>
          <select id="filter-priority" class="filter-select" title="Filter by priority">
            <option value="">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select id="filter-tag" class="filter-select" title="Filter by tag">
            <option value="">All Tags</option>
          </select>
          <button id="done-tab-btn" class="done-tab-btn" title="View completed sprints">
            <span class="done-icon">✓</span>
            <span>Done</span>
          </button>
        </div>
      </div>

      <!-- Issue input row (always visible) -->
      <div class="issue-input-row">
        <input id="issue-title" type="text" placeholder="Add an issue and press Enter" />
        <select id="issue-priority" class="issue-priority-select">
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <button id="add-issue-btn" class="issue-add-btn" title="Add">+</button>
      </div>

      <!-- Issues List -->
      <div id="issues-list" class="issues-list">
        <div class="issue-group" data-status="in_progress">
          <div class="issue-group-header">
            <span class="issue-group-title">In Progress</span>
            <span class="issue-group-count">0</span>
          </div>
          <div class="issue-group-items"></div>
        </div>
        <div class="issue-group" data-status="todo">
          <div class="issue-group-header">
            <span class="issue-group-title">Todo</span>
            <span class="issue-group-count">0</span>
          </div>
          <div class="issue-group-items"></div>
        </div>
        <div class="issue-group collapsed" data-status="review">
          <div class="issue-group-header">
            <span class="issue-group-title">Review</span>
            <span class="issue-group-count">0</span>
          </div>
          <div class="issue-group-items"></div>
        </div>
        <div class="issue-group collapsed" data-status="done">
          <div class="issue-group-header">
            <span class="issue-group-title">Done</span>
            <span class="issue-group-count">0</span>
          </div>
          <div class="issue-group-items"></div>
        </div>
      </div>

      <!-- Backlog Section (shown within sprint views) -->
      <div id="backlog-section" class="backlog-section hidden">
        <div class="backlog-divider">
          <span class="backlog-divider-line"></span>
          <span class="backlog-divider-text">Backlog</span>
          <span class="backlog-divider-line"></span>
        </div>
        <div class="backlog-header" id="backlog-header">
          <span class="backlog-title">Backlog</span>
          <span class="backlog-count" id="backlog-count">0</span>
          <span class="backlog-expand-icon">+</span>
        </div>
        <div class="backlog-items" id="backlog-items"></div>
      </div>

      <div id="issues-empty" class="empty">No issues yet. Create one above.</div>
    </div>

    <!-- Kanban Section (Pro only) -->
    <div id="kanban-section" class="section hidden">
      <div class="kanban-sprint-tabs-container">
        <div id="kanban-sprint-tabs" class="sprint-tabs"></div>
        <div class="sprint-filters">
          <button id="kanban-tags-toggle-btn" class="filter-toggle active" title="Show/hide tags on cards">
            <span class="toggle-icon">🏷️</span>
            <span>Tags</span>
          </button>
          <select id="kanban-filter-priority" class="filter-select" title="Filter by priority">
            <option value="">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select id="kanban-filter-tag" class="filter-select" title="Filter by tag">
            <option value="">All Tags</option>
          </select>
        </div>
      </div>
      <div class="kanban-board">
        <div class="kanban-column" data-status="todo">
          <div class="kanban-column-header">
            <span class="kanban-column-title">Todo</span>
            <span class="kanban-column-count" id="kanban-todo-count">0</span>
          </div>
          <div class="kanban-column-items" id="kanban-todo-items"></div>
        </div>
        <div class="kanban-column" data-status="in_progress">
          <div class="kanban-column-header">
            <span class="kanban-column-title">In Progress</span>
            <span class="kanban-column-count" id="kanban-inprogress-count">0</span>
          </div>
          <div class="kanban-column-items" id="kanban-inprogress-items"></div>
        </div>
        <div class="kanban-column" data-status="review">
          <div class="kanban-column-header">
            <span class="kanban-column-title">Review</span>
            <span class="kanban-column-count" id="kanban-review-count">0</span>
          </div>
          <div class="kanban-column-items" id="kanban-review-items"></div>
        </div>
        <div class="kanban-column" data-status="done">
          <div class="kanban-column-header">
            <span class="kanban-column-title">Done</span>
            <span class="kanban-column-count" id="kanban-done-count">0</span>
          </div>
          <div class="kanban-column-items" id="kanban-done-items"></div>
        </div>
      </div>
      <div id="kanban-empty" class="empty">No issues yet.</div>
    </div>

    <!-- Account Section (Pro only) -->
    <div id="account-section" class="section hidden">
      <div class="account-section">
        <div class="account-header">Account Settings</div>

        <div class="account-field">
          <label>Email</label>
          <span id="account-email">-</span>
        </div>
        <div class="account-field">
          <label>Plan</label>
          <span id="account-tier" class="tier-badge">-</span>
        </div>

        <div class="account-section-title">MCP Tokens</div>
        <p style="font-size: 0.85em; color: var(--vscode-descriptionForeground); margin-bottom: 12px;">
          API tokens for Claude Code and other MCP clients. <a id="mcp-setup-link" class="help-link">Setup guide</a>
        </p>

        <div id="mcp-token-created-banner" class="mcp-token-created-banner">
          <div class="mcp-token-created-title">Token Created!</div>
          <div id="mcp-token-created-value" class="mcp-token-created-value"></div>
          <div class="mcp-token-created-warning">
            Copy this token now. You won't be able to see it again.
          </div>
          <div class="mcp-token-created-actions">
            <button id="copy-new-token-btn" class="button">Copy Token</button>
            <button id="dismiss-new-token-btn" class="button secondary">Done</button>
          </div>
        </div>

        <div id="mcp-tokens-list" class="mcp-tokens-list">
          <div class="mcp-tokens-empty">No API tokens yet</div>
        </div>

        <div class="mcp-token-create-row">
          <input type="text" id="token-name-input" class="todo-input" placeholder="Token name" value="Panel Todo MCP" />
          <button id="create-token-btn" class="button">Create</button>
        </div>

        <div class="account-section-title">Your Data</div>

        <div class="account-action">
          <div class="action-info">
            <strong>Export My Data</strong>
            <p>Download all your data in JSON format</p>
          </div>
          <button id="export-data-btn" class="button secondary">Export</button>
        </div>

        <div class="account-action danger-zone">
          <div class="action-info">
            <strong>Delete Account</strong>
            <p>Permanently delete your account and all data</p>
          </div>
          <button id="delete-account-btn" class="button danger">Delete</button>
        </div>

        <div class="account-links">
          <a id="docs-link">Documentation</a>
          <a id="privacy-link">Privacy Policy</a>
          <a id="terms-link">Terms of Service</a>
        </div>
      </div>
    </div>

    <!-- Delete Account Dialog -->
    <div id="delete-account-dialog" class="dialog-overlay hidden">
      <div class="dialog">
        <div class="dialog-title">Delete Account</div>
        <div class="dialog-message">
          <p>This will permanently delete:</p>
          <ul style="margin: 8px 0; padding-left: 20px;">
            <li>Your account and profile</li>
            <li>All projects, issues, and sprints</li>
            <li>All synced todos</li>
            <li>Your subscription (will be cancelled)</li>
          </ul>
          <p><strong>This action cannot be undone.</strong></p>
          <div class="delete-confirm-input">
            <label>Type DELETE to confirm:</label>
            <input type="text" id="delete-confirm-text" placeholder="DELETE" />
          </div>
        </div>
        <div class="dialog-actions">
          <button id="delete-account-cancel" class="button secondary">Cancel</button>
          <button id="delete-account-confirm" class="button danger" disabled>Delete My Account</button>
        </div>
      </div>
    </div>

    <!-- Issue Detail Panel (shared between Issues and Kanban tabs) -->
    <div id="issue-detail" class="issue-detail">
      <div class="issue-detail-header">
        <span id="detail-key" class="detail-key">PT-1</span>
        <button id="detail-close" class="detail-close" title="Close">×</button>
      </div>
      <div class="issue-detail-body">
        <div class="detail-field">
          <label>Title</label>
          <input id="detail-title" type="text" placeholder="Issue title" />
        </div>
        <div class="detail-field">
          <label>Description</label>
          <textarea id="detail-description" placeholder="Add a description..." rows="4"></textarea>
        </div>
        <div class="detail-row">
          <div class="detail-field half">
            <label>Status</label>
            <select id="detail-status">
              <option value="todo">Todo</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </select>
          </div>
          <div class="detail-field half">
            <label>Priority</label>
            <select id="detail-priority">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
        <div class="detail-field">
          <label>Sprint</label>
          <select id="detail-sprint">
            <option value="">No Sprint (Backlog)</option>
          </select>
        </div>
        <div class="detail-field">
          <label>Tags</label>
          <div id="detail-tags" class="detail-tags">
            <div id="issue-tags-list" class="issue-tags"></div>
            <div class="tag-selector">
              <button id="add-tag-btn" class="add-tag-btn" title="Add tag">+ Add Tag</button>
              <div id="tag-dropdown" class="tag-dropdown">
                <div id="tag-dropdown-list" class="tag-dropdown-list"></div>
                <button id="manage-tags-btn" class="manage-tags-btn">Manage Tags</button>
              </div>
            </div>
          </div>
        </div>
        <div class="detail-comments">
          <label>Comments</label>
          <div id="comments-list" class="comments-list"></div>
          <div class="comment-input-row">
            <input id="comment-input" type="text" placeholder="Add a comment..." />
            <button id="add-comment-btn" class="button small">Add</button>
          </div>
        </div>
      </div>
      <div class="issue-detail-footer">
        <button id="detail-delete" class="button danger">Delete</button>
        <div class="detail-actions">
          <button id="detail-cancel" class="button secondary">Cancel</button>
          <button id="detail-save" class="button">Save</button>
        </div>
      </div>
    </div>

    <div id="upgrade-prompt" class="upgrade-prompt">
      <a id="mcp-link" class="mcp-cta" href="#">
        <span class="mcp-icon">&#x1F517;</span>
        <span class="mcp-text">MCP Server for AI Agents</span>
      </a>
      <div class="upgrade-cta">
        <div class="upgrade-text">
          <strong>Go Pro</strong>
          <span class="upgrade-desc">Projects, issues, sprints, cloud sync</span>
        </div>
        <button id="upgrade-btn" class="button">Sign up</button>
      </div>
    </div>

    <!-- Trash Drop Zone -->
    <div id="trash-drop-zone" class="trash-drop-zone">
      <span class="trash-icon">🗑️</span>
      <span class="trash-text">Drop to delete</span>
    </div>

    <!-- Sprint Context Menu -->
    <div id="sprint-context-menu" class="context-menu">
      <div class="context-menu-item" data-action="edit">Edit Sprint</div>
      <div class="context-menu-item" data-action="complete">Complete Sprint</div>
      <div class="context-menu-item" data-action="reactivate">Reactivate Sprint</div>
      <div class="context-menu-separator"></div>
      <div class="context-menu-item danger" data-action="delete">Delete Sprint</div>
    </div>

    <!-- Edit Sprint Dialog -->
    <div id="edit-sprint-dialog" class="dialog-overlay">
      <div class="dialog">
        <div class="dialog-title">Edit Sprint</div>
        <input type="text" id="edit-sprint-name" class="dialog-input" placeholder="Sprint name">
        <div class="dialog-actions">
          <button id="edit-sprint-cancel" class="button secondary">Cancel</button>
          <button id="edit-sprint-save" class="button">Save</button>
        </div>
      </div>
    </div>

    <!-- Delete Sprint Dialog -->
    <div id="delete-sprint-dialog" class="dialog-overlay">
      <div class="dialog">
        <div class="dialog-title">Delete Sprint</div>
        <div class="dialog-message">What should happen to open issues in this sprint?</div>
        <div class="dialog-options">
          <label class="dialog-option">
            <input type="radio" name="delete-action" value="move" checked>
            <span>Move issues to Backlog</span>
          </label>
          <label class="dialog-option">
            <input type="radio" name="delete-action" value="delete">
            <span>Delete issues</span>
          </label>
        </div>
        <div class="dialog-actions">
          <button id="delete-sprint-cancel" class="button secondary">Cancel</button>
          <button id="delete-sprint-confirm" class="button danger">Delete</button>
        </div>
      </div>
    </div>

    <!-- Delete Issue Dialog -->
    <div id="delete-issue-dialog" class="dialog-overlay">
      <div class="dialog">
        <div class="dialog-title">Delete Issue</div>
        <div class="dialog-text" id="delete-issue-text">Delete issue PT-1?</div>
        <div class="dialog-actions">
          <button id="delete-issue-cancel" class="button secondary">Cancel</button>
          <button id="delete-issue-confirm" class="button danger">Delete</button>
        </div>
      </div>
    </div>

    <!-- Complete Sprint Dialog -->
    <div id="complete-sprint-dialog" class="dialog-overlay">
      <div class="dialog">
        <div class="dialog-title">Complete Sprint</div>
        <div class="dialog-message">What should happen to incomplete issues?</div>
        <div class="dialog-options">
          <label class="dialog-option">
            <input type="radio" name="complete-action" value="move" checked>
            <span>Move to Backlog</span>
          </label>
          <label class="dialog-option">
            <input type="radio" name="complete-action" value="keep">
            <span>Mark all as Done</span>
          </label>
        </div>
        <div class="dialog-actions">
          <button id="complete-sprint-cancel" class="button secondary">Cancel</button>
          <button id="complete-sprint-confirm" class="button">Complete</button>
        </div>
      </div>
    </div>

    <!-- Tag Management Dialog -->
    <div id="tag-management-dialog" class="dialog-overlay">
      <div class="dialog tag-management-dialog">
        <div class="tag-dialog-header">
          <h2>Manage Tags</h2>
          <p>Create and organize tags for your issues</p>
        </div>
        <div class="tag-list" id="tag-list"></div>
        <div class="tag-create-section">
          <div class="tag-create-section-title">Create New Tag</div>
          <div class="tag-create-form">
            <input type="text" id="new-tag-name" placeholder="Tag name" maxlength="50">
            <div class="tag-color-picker-wrapper">
              <div id="tag-color-preview" class="tag-color-preview" style="background: #3794FF"></div>
              <input type="color" id="new-tag-color" class="tag-color-picker" value="#3794FF">
            </div>
            <button id="create-tag-btn" class="button">Add</button>
          </div>
          <div class="tag-preset-colors" id="tag-preset-colors">
            <div class="tag-preset-color selected" data-color="#3794FF" style="background: #3794FF" title="Blue"></div>
            <div class="tag-preset-color" data-color="#4CAF50" style="background: #4CAF50" title="Green"></div>
            <div class="tag-preset-color" data-color="#FF9800" style="background: #FF9800" title="Orange"></div>
            <div class="tag-preset-color" data-color="#F44336" style="background: #F44336" title="Red"></div>
            <div class="tag-preset-color" data-color="#9C27B0" style="background: #9C27B0" title="Purple"></div>
            <div class="tag-preset-color" data-color="#00BCD4" style="background: #00BCD4" title="Cyan"></div>
            <div class="tag-preset-color" data-color="#E91E63" style="background: #E91E63" title="Pink"></div>
            <div class="tag-preset-color" data-color="#795548" style="background: #795548" title="Brown"></div>
            <div class="tag-preset-color" data-color="#607D8B" style="background: #607D8B" title="Gray"></div>
            <div class="tag-preset-color" data-color="#FFEB3B" style="background: #FFEB3B" title="Yellow"></div>
          </div>
        </div>
        <div class="tag-dialog-footer">
          <button id="tag-management-close" class="button tag-management-close">Done</button>
        </div>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    // Input sanitization helper - removes control characters and limits length
    function sanitizeInput(text, maxLength = 1000) {
      if (typeof text !== 'string') return '';
      // Remove control characters (except newlines/tabs for descriptions)
      return text.replace(/[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]/g, '').trim().substring(0, maxLength);
    }

    const input = document.getElementById("todo-input");
    const addBtn = document.getElementById("add-btn");
    const list = document.getElementById("list");
    const empty = document.getElementById("empty");
    const unassignedSection = document.getElementById("unassigned-section");
    const unassignedList = document.getElementById("unassigned-list");
    const migrateBtn = document.getElementById("migrate-btn");
    const undoBar = document.getElementById("undo-bar");
    const undoBtn = document.getElementById("undo-btn");
    const authStatus = document.getElementById("auth-status");
    const syncIndicator = document.getElementById("sync-indicator");
    const offlineIndicator = document.getElementById("offline-indicator");
    const conflictsBanner = document.getElementById("conflicts-banner");
    const conflictsList = document.getElementById("conflicts-list");
    const resolveAllLocal = document.getElementById("resolve-all-local");
    const resolveAllRemote = document.getElementById("resolve-all-remote");
    const signInBtn = document.getElementById("sign-in-btn");
    const signOutBtn = document.getElementById("sign-out-btn");
    const authPending = document.getElementById("auth-pending");
    const authLink = document.getElementById("auth-link");
    const authCode = document.getElementById("auth-code");
    const authOpenBtn = document.getElementById("auth-open-btn");
    const authCopyBtn = document.getElementById("auth-copy-btn");
    const upgradePrompt = document.getElementById("upgrade-prompt");
    const upgradeBtn = document.getElementById("upgrade-btn");
    const mcpLink = document.getElementById("mcp-link");
    const devToolbar = document.getElementById("dev-toolbar");
    const devButtons = devToolbar.querySelectorAll("button[data-tier]");

    // Project selector elements
    const projectSelector = document.getElementById("project-selector");
    const projectSelect = document.getElementById("project-select");
    const projectAddBtn = document.getElementById("project-add-btn");
    const projectCreateDialog = document.getElementById("project-create-dialog");
    const projectNameInput = document.getElementById("project-name");
    const projectKeyInput = document.getElementById("project-key");
    const projectCancelBtn = document.getElementById("project-cancel-btn");
    const projectCreateBtn = document.getElementById("project-create-btn");

    // Tab elements
    const tabBar = document.getElementById("tab-bar");
    const tabTodos = document.getElementById("tab-todos");
    const tabIssues = document.getElementById("tab-issues");
    const tabKanban = document.getElementById("tab-kanban");
    const tabAccount = document.getElementById("tab-account");
    const todosSection = document.getElementById("todos-section");
    const issuesSection = document.getElementById("issues-section");
    const kanbanSection = document.getElementById("kanban-section");
    const accountSection = document.getElementById("account-section");

    // Account elements
    const accountEmail = document.getElementById("account-email");
    const accountTier = document.getElementById("account-tier");
    const exportDataBtn = document.getElementById("export-data-btn");
    const deleteAccountBtn = document.getElementById("delete-account-btn");
    const privacyLink = document.getElementById("privacy-link");
    const termsLink = document.getElementById("terms-link");
    const docsLink = document.getElementById("docs-link");
    const todosHelpLink = document.getElementById("todos-help-link");
    const mcpSetupLink = document.getElementById("mcp-setup-link");
    const deleteAccountDialog = document.getElementById("delete-account-dialog");
    const deleteConfirmText = document.getElementById("delete-confirm-text");
    const deleteAccountCancel = document.getElementById("delete-account-cancel");
    const deleteAccountConfirm = document.getElementById("delete-account-confirm");

    // MCP Token elements
    const mcpTokensList = document.getElementById("mcp-tokens-list");
    const tokenNameInput = document.getElementById("token-name-input");
    const createTokenBtn = document.getElementById("create-token-btn");
    const mcpTokenCreatedBanner = document.getElementById("mcp-token-created-banner");
    const mcpTokenCreatedValue = document.getElementById("mcp-token-created-value");
    const copyNewTokenBtn = document.getElementById("copy-new-token-btn");
    const dismissNewTokenBtn = document.getElementById("dismiss-new-token-btn");

    // Kanban elements
    const kanbanBoard = document.querySelector(".kanban-board");
    const kanbanColumns = document.querySelectorAll(".kanban-column");
    const kanbanEmpty = document.getElementById("kanban-empty");
    const kanbanSprintTabs = document.getElementById("kanban-sprint-tabs");

    // Issues elements
    const addIssueBtn = document.getElementById("add-issue-btn");
    const issueTitle = document.getElementById("issue-title");
    const issuePriority = document.getElementById("issue-priority");
    const issuesList = document.getElementById("issues-list");
    const issuesEmpty = document.getElementById("issues-empty");
    const issueGroups = issuesList.querySelectorAll(".issue-group");

    // Detail panel elements
    const issueDetail = document.getElementById("issue-detail");
    const detailKey = document.getElementById("detail-key");
    const detailTitle = document.getElementById("detail-title");
    const detailDescription = document.getElementById("detail-description");
    const detailStatus = document.getElementById("detail-status");
    const detailPriority = document.getElementById("detail-priority");
    const detailSprint = document.getElementById("detail-sprint");
    const detailClose = document.getElementById("detail-close");
    const detailSave = document.getElementById("detail-save");
    const detailCancel = document.getElementById("detail-cancel");
    const detailDelete = document.getElementById("detail-delete");
    const commentsList = document.getElementById("comments-list");
    const commentInput = document.getElementById("comment-input");
    const addCommentBtn = document.getElementById("add-comment-btn");

    // Tag elements
    const issueTagsList = document.getElementById("issue-tags-list");
    const addTagBtn = document.getElementById("add-tag-btn");
    const tagDropdown = document.getElementById("tag-dropdown");
    const tagDropdownList = document.getElementById("tag-dropdown-list");
    const manageTagsBtn = document.getElementById("manage-tags-btn");
    const tagManagementDialog = document.getElementById("tag-management-dialog");
    const tagList = document.getElementById("tag-list");
    const newTagName = document.getElementById("new-tag-name");
    const newTagColor = document.getElementById("new-tag-color");
    const createTagBtn = document.getElementById("create-tag-btn");
    const tagManagementClose = document.getElementById("tag-management-close");
    const tagColorPreview = document.getElementById("tag-color-preview");
    const tagPresetColors = document.getElementById("tag-preset-colors");

    // Sprint tab elements
    const sprintTabsContainer = document.querySelector(".sprint-tabs-container");
    const sprintTabs = document.getElementById("sprint-tabs");
    const newSprintBtn = document.getElementById("new-sprint-btn");
    const sprintCreate = document.getElementById("sprint-create");
    const sprintName = document.getElementById("sprint-name");
    const sprintSaveBtn = document.getElementById("sprint-save-btn");
    const doneTabBtn = document.getElementById("done-tab-btn");

    // Filter elements (now inline with sprints)
    const tagsToggleBtn = document.getElementById("tags-toggle-btn");
    const filterPrioritySelect = document.getElementById("filter-priority");
    const filterTagSelect = document.getElementById("filter-tag");

    // Kanban filter elements (synced with issues filters)
    const kanbanTagsToggleBtn = document.getElementById("kanban-tags-toggle-btn");
    const kanbanFilterPrioritySelect = document.getElementById("kanban-filter-priority");
    const kanbanFilterTagSelect = document.getElementById("kanban-filter-tag");

    // Backlog section elements
    const backlogSection = document.getElementById("backlog-section");
    const backlogHeader = document.getElementById("backlog-header");
    const backlogCount = document.getElementById("backlog-count");
    const backlogItems = document.getElementById("backlog-items");

    // Context menu and dialog elements
    const sprintContextMenu = document.getElementById("sprint-context-menu");
    const editSprintDialog = document.getElementById("edit-sprint-dialog");
    const editSprintName = document.getElementById("edit-sprint-name");
    const editSprintCancel = document.getElementById("edit-sprint-cancel");
    const editSprintSave = document.getElementById("edit-sprint-save");
    const deleteSprintDialog = document.getElementById("delete-sprint-dialog");
    const deleteSprintCancel = document.getElementById("delete-sprint-cancel");
    const deleteSprintConfirm = document.getElementById("delete-sprint-confirm");
    const completeSprintDialog = document.getElementById("complete-sprint-dialog");
    const completeSprintCancel = document.getElementById("complete-sprint-cancel");
    const completeSprintConfirm = document.getElementById("complete-sprint-confirm");
    const deleteIssueDialog = document.getElementById("delete-issue-dialog");
    const deleteIssueText = document.getElementById("delete-issue-text");
    const deleteIssueCancel = document.getElementById("delete-issue-cancel");
    const deleteIssueConfirm = document.getElementById("delete-issue-confirm");
    const trashDropZone = document.getElementById("trash-drop-zone");

    let undoTimeout = null;
    let currentDevTier = "free";
    let currentUserEmail = null;
    let currentTab = "todos";
    let issues = [];
    let sprints = [];
    let tags = [];
    let issueTags = {}; // { issueId: [tag, ...] }
    let projects = [];
    let currentProjectId = null;
    let backlogIssues = [];
    let backlogExpanded = false;
    let selectedIssue = null;
    let draggedIssue = null;
    let selectedSprintFilter = ""; // "" = all, "__backlog__" = backlog sprint, or sprint id
    let kanbanSprintFilter = ""; // "" = all, "__backlog__" = backlog sprint, or sprint id
    let contextMenuSprintId = null; // Sprint ID for context menu actions
    let viewingDone = false; // Whether viewing the Done tab (completed sprints)
    let showTagsOnIssues = true; // Whether to show tags on issue items
    let filterPriority = ""; // "" = all, or "low", "medium", "high", "critical"
    let filterTagId = ""; // "" = all, or tag id

    // Fake issues data for testing
    const fakeIssues = [
      { id: "1", key: "PT-1", title: "Implement cloud sync", status: "in_progress", priority: "high", labels: ["feature"] },
      { id: "2", key: "PT-2", title: "Fix login timeout bug", status: "in_progress", priority: "critical", labels: ["bug"] },
      { id: "3", key: "PT-3", title: "Add dark mode support", status: "todo", priority: "medium", labels: ["feature"] },
      { id: "4", key: "PT-4", title: "Update documentation", status: "todo", priority: "low", labels: ["docs"] },
      { id: "5", key: "PT-5", title: "Refactor auth module", status: "todo", priority: "medium", labels: ["tech-debt"] },
      { id: "6", key: "PT-6", title: "Add unit tests", status: "todo", priority: "high", labels: ["testing"] },
      { id: "7", key: "PT-7", title: "Code review PR #123", status: "review", priority: "medium", labels: [] },
      { id: "8", key: "PT-8", title: "Deploy v1.0", status: "done", priority: "high", labels: ["release"] },
    ];

    function showUndoBar() {
      // Clear any existing timeout
      if (undoTimeout) {
        clearTimeout(undoTimeout);
      }

      undoBar.classList.add("visible");

      // Auto-hide after 5 seconds
      undoTimeout = setTimeout(() => {
        undoBar.classList.remove("visible");
      }, 5000);
    }

    function hideUndoBar() {
      if (undoTimeout) {
        clearTimeout(undoTimeout);
      }
      undoBar.classList.remove("visible");
    }

    function renderAuthPending(pending) {
      if (!pending) {
        authPending.classList.remove("visible");
        authCode.textContent = "";
        authLink.textContent = "";
        return;
      }

      authPending.classList.add("visible");
      authCode.textContent = pending.userCode;
      authLink.textContent = pending.verificationUri;
    }

    function renderConnectionState(connected) {
      offlineIndicator.classList.toggle("visible", !connected);
    }

    function renderSyncState(syncing) {
      syncIndicator.classList.toggle("visible", syncing);
    }

    function renderConflicts(conflicts) {
      if (!conflicts || conflicts.length === 0) {
        conflictsBanner.classList.remove("visible");
        conflictsList.innerHTML = "";
        return;
      }

      conflictsBanner.classList.add("visible");
      conflictsList.innerHTML = conflicts.map(conflict => \`
        <div class="conflict-item" data-id="\${conflict.id}">
          <div class="conflict-label">Local (this device)</div>
          <div class="conflict-text local">\${escapeHtml(conflict.localTodo.text)}</div>
          <div class="conflict-label">Remote (other device)</div>
          <div class="conflict-text remote">\${escapeHtml(conflict.remoteTodo.text)}</div>
          <div class="conflict-buttons">
            <button class="conflict-btn local" data-action="keep_local">Keep Local</button>
            <button class="conflict-btn remote" data-action="keep_remote">Keep Remote</button>
            <button class="conflict-btn both" data-action="keep_both">Keep Both</button>
          </div>
        </div>
      \`).join("");

      // Add event listeners for individual conflict buttons
      conflictsList.querySelectorAll(".conflict-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const item = e.target.closest(".conflict-item");
          const conflictId = item.dataset.id;
          const resolution = e.target.dataset.action;
          vscode.postMessage({ type: "resolveConflict", id: conflictId, resolution });
        });
      });
    }

    function renderAuthState(state) {
      const signedIn = Boolean(state && state.signedIn);
      const tier = state?.tier || "free";
      const isPro = tier === "pro" || tier === "team";

      // Update auth status text and tier badge class
      if (!signedIn) {
        authStatus.textContent = "Signed out";
        authStatus.classList.remove("pro");
      } else {
        authStatus.textContent = isPro ? "Pro" : "Free";
        authStatus.classList.toggle("pro", isPro);
      }

      signInBtn.classList.toggle("hidden", signedIn || Boolean(state && state.pending));
      signOutBtn.classList.toggle("hidden", !signedIn);

      // Show upgrade prompt for signed-out users (Pro users don't need it)
      const showUpgrade = !isPro;
      upgradePrompt.classList.toggle("visible", showUpgrade);
      document.body.classList.toggle("has-upgrade-prompt", showUpgrade);

      // Update button text based on auth state
      if (showUpgrade) {
        upgradeBtn.textContent = "Sign up";
      }

      // IMPORTANT: Always update currentDevTier (used by renderProjectSelector)
      currentDevTier = signedIn ? tier : "out";

      // Dev toolbar
      if (state?.devMode) {
        devToolbar.classList.add("visible");
        document.body.classList.add("has-dev-toolbar");
        devButtons.forEach(btn => {
          btn.classList.toggle("active", btn.dataset.tier === currentDevTier);
        });
      } else {
        devToolbar.classList.remove("visible");
        document.body.classList.remove("has-dev-toolbar");
      }

      // Re-render project selector when tier changes (Pro users need to see it)
      if (isPro) {
        renderProjectSelector();
      }

      renderAuthPending(state ? state.pending : null);

      // Show/hide tabs and issues section based on tier
      if (isPro) {
        tabBar.classList.add("visible");
        // Fetch real data from backend when Pro
        vscode.postMessage({ type: "fetchProjects" });
        vscode.postMessage({ type: "fetchIssues" });
        vscode.postMessage({ type: "fetchSprints" });
        vscode.postMessage({ type: "fetchTags" });
      } else {
        tabBar.classList.remove("visible");
        projectSelector.classList.remove("has-projects");
        // Reset to todos tab if not Pro
        switchTab("todos");
      }
    }

    function switchTab(tab) {
      currentTab = tab;
      tabTodos.classList.toggle("active", tab === "todos");
      tabIssues.classList.toggle("active", tab === "issues");
      tabKanban.classList.toggle("active", tab === "kanban");
      tabAccount.classList.toggle("active", tab === "account");
      todosSection.classList.toggle("hidden", tab !== "todos");
      issuesSection.classList.toggle("hidden", tab !== "issues");
      kanbanSection.classList.toggle("hidden", tab !== "kanban");
      accountSection.classList.toggle("hidden", tab !== "account");

      // Render kanban when switching to kanban tab
      if (tab === "kanban") {
        renderKanban();
      }

      // Update account info when switching to account tab
      if (tab === "account") {
        updateAccountInfo();
        // Fetch API tokens for MCP section
        vscode.postMessage({ type: "listApiTokens" });
      }
    }

    function updateAccountInfo() {
      // Update email display
      accountEmail.textContent = currentUserEmail || "-";

      // Update tier badge
      const tier = currentDevTier || "free";
      accountTier.textContent = tier.charAt(0).toUpperCase() + tier.slice(1);
      accountTier.className = "tier-badge";
      if (tier === "pro") accountTier.classList.add("pro");
      if (tier === "team") accountTier.classList.add("team");
    }

    // ==================== PROJECT SELECTOR ====================

    function renderProjectSelector() {
      // Show project elements if Pro (for creating projects)
      const isPro = currentDevTier === "pro" || currentDevTier === "team";
      if (!isPro) {
        projectSelector.classList.remove("has-projects");
        return;
      }

      // Show project elements (always if Pro, to allow creating projects)
      projectSelector.classList.add("has-projects");

      // If no projects yet, show "Create your first project" in dropdown
      if (projects.length === 0) {
        projectSelect.innerHTML = '<option value="" disabled selected>Create your first project →</option>';
        return;
      }

      // Populate dropdown
      projectSelect.innerHTML = "";
      projects.forEach(project => {
        const option = document.createElement("option");
        option.value = project.id;
        option.textContent = \`[\${project.key}] \${project.name}\`;
        if (project.id === currentProjectId) {
          option.selected = true;
        }
        projectSelect.appendChild(option);
      });
    }

    // Project selector event listeners
    projectSelect.addEventListener("change", (e) => {
      const newProjectId = e.target.value;
      if (newProjectId && newProjectId !== currentProjectId) {
        vscode.postMessage({ type: "switchProject", projectId: newProjectId });
      }
    });

    let userEditedKey = false;
    projectAddBtn.addEventListener("click", () => {
      projectCreateDialog.classList.add("visible");
      projectNameInput.value = "";
      projectKeyInput.value = "";
      userEditedKey = false;
      projectNameInput.focus();
    });

    projectCancelBtn.addEventListener("click", () => {
      projectCreateDialog.classList.remove("visible");
    });

    projectCreateBtn.addEventListener("click", () => {
      const name = sanitizeInput(projectNameInput.value, 100);
      const key = sanitizeInput(projectKeyInput.value, 10).toUpperCase();
      if (name && key) {
        vscode.postMessage({ type: "createProject", name, key });
        projectCreateDialog.classList.remove("visible");
      }
    });

    // Auto-generate key from name as user types
    let isAutoGenerating = false;
    projectNameInput.addEventListener("input", () => {
      if (!userEditedKey) {
        // Auto-fill prefix based on name
        const name = projectNameInput.value.trim();
        const words = name.split(/\s+/).filter(w => w.length > 0);
        let key = "";
        if (words.length === 0) {
          key = "";
        } else if (words.length === 1) {
          // Single word: first 2 letters
          key = words[0].substring(0, 2).toUpperCase();
        } else {
          // Multiple words: first letter of each word
          key = words.map(w => w[0]).join("").toUpperCase();
        }
        isAutoGenerating = true;
        projectKeyInput.value = key;
        isAutoGenerating = false;
      }
    });

    // Track if user manually edits the key (only when they actually type)
    projectKeyInput.addEventListener("input", () => {
      if (!isAutoGenerating) {
        userEditedKey = true;
      }
      projectKeyInput.value = projectKeyInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    });

    // Enter key to create project
    projectKeyInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        projectCreateBtn.click();
      }
    });

    // ==================== END PROJECT SELECTOR ====================

    // ==================== API TOKEN RENDERING ====================

    function renderApiTokens(tokens) {
      if (!mcpTokensList) return;

      if (!tokens || tokens.length === 0) {
        mcpTokensList.innerHTML = '<div class="mcp-tokens-empty">No API tokens yet</div>';
        return;
      }

      mcpTokensList.innerHTML = tokens.map(token => {
        const createdDate = new Date(token.createdAt).toLocaleDateString();
        const lastUsed = token.lastUsedAt
          ? new Date(token.lastUsedAt).toLocaleDateString()
          : "Never";

        return \`
          <div class="mcp-token-item" data-token-id="\${token.id}">
            <div class="mcp-token-info">
              <div class="mcp-token-name">\${escapeHtml(token.name)}</div>
              <div class="mcp-token-meta">Created \${createdDate} · Last used: \${lastUsed}</div>
            </div>
            <button class="mcp-token-revoke" onclick="revokeToken('\${token.id}')">Revoke</button>
          </div>
        \`;
      }).join("");
    }

    // Global function for revoking tokens (called from onclick)
    window.revokeToken = function(tokenId) {
      if (confirm("Revoke this API token? Any MCP clients using it will stop working.")) {
        vscode.postMessage({ type: "revokeApiToken", tokenId });
      }
    };

    // ==================== END API TOKEN RENDERING ====================

    function renderIssues() {
      // Get filtered issues based on sprint selection
      const filteredIssues = getFilteredIssues();

      // Check if viewing a completed sprint
      const isCompletedSprint = viewingDone && selectedSprintFilter;

      // Group issues by status
      const grouped = {
        in_progress: [],
        todo: [],
        review: [],
        done: [],
      };

      filteredIssues.forEach(issue => {
        if (grouped[issue.status]) {
          grouped[issue.status].push(issue);
        }
      });

      // Render each group
      issueGroups.forEach(group => {
        const status = group.dataset.status;
        const items = grouped[status] || [];
        const countEl = group.querySelector(".issue-group-count");
        const itemsEl = group.querySelector(".issue-group-items");

        // Hide non-done groups when viewing completed sprints
        if (isCompletedSprint && status !== "done") {
          group.style.display = "none";
          return;
        } else {
          group.style.display = "";
        }

        countEl.textContent = items.length;
        itemsEl.innerHTML = "";

        items.forEach(issue => {
          const div = document.createElement("div");
          div.className = "issue-item";
          div.dataset.id = issue.id;
          div.draggable = !isCompletedSprint; // Disable drag in completed sprints
          div.innerHTML = \`
            <span class="issue-key">\${issue.key}</span>
            <span class="issue-title">\${issue.title}</span>
            \${getQuickTagDropdownHtml(issue.id)}
            \${getIssueTagsHtml(issue.id)}
            <span class="issue-priority \${issue.priority}">\${issue.priority}</span>
            <button class="send-to-terminal-btn" title="Send to terminal">Send to Terminal</button>
          \`;

          // Quick tag dropdown
          const quickTagBtn = div.querySelector(".quick-tag-btn");
          const quickTagPopover = div.querySelector(".quick-tag-popover");
          if (quickTagBtn && quickTagPopover) {
            quickTagBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              // Close any other open popovers
              document.querySelectorAll(".quick-tag-popover.visible").forEach(p => {
                if (p !== quickTagPopover) p.classList.remove("visible");
              });
              // Position the popover below the button
              const rect = quickTagBtn.getBoundingClientRect();
              quickTagPopover.style.top = (rect.bottom + 4) + "px";
              quickTagPopover.style.left = rect.left + "px";
              quickTagPopover.classList.toggle("visible");
            });

            quickTagPopover.querySelectorAll(".quick-tag-option").forEach(opt => {
              opt.addEventListener("click", (e) => {
                e.stopPropagation();
                const tagId = opt.dataset.tagId;
                const issueId = opt.dataset.issueId;
                const isSelected = opt.classList.contains("selected");

                if (isSelected) {
                  vscode.postMessage({ type: "removeTagFromIssue", issueId, tagId });
                } else {
                  vscode.postMessage({ type: "addTagToIssue", issueId, tagId });
                }
                quickTagPopover.classList.remove("visible");
              });
            });
          }

          // Send to Terminal button
          const sendBtn = div.querySelector(".send-to-terminal-btn");
          sendBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            vscode.postMessage({ type: "sendToTerminal", text: \`[\${issue.key}] \${issue.title}\` });
          });

          // Click to open detail panel
          div.addEventListener("click", (e) => {
            // Don't open if we just finished dragging
            if (div.dataset.justDragged) {
              delete div.dataset.justDragged;
              return;
            }
            openDetailPanel(issue);
          });

          // Drag events (only for non-completed sprints)
          if (!isCompletedSprint) {
            div.addEventListener("dragstart", (e) => {
              div.classList.add("dragging");
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", issue.id);
              draggedIssue = issue;
              trashDropZone.classList.add("visible");
            });

            div.addEventListener("dragend", () => {
              div.classList.remove("dragging");
              div.dataset.justDragged = "true";
              // Clear after a short delay
              setTimeout(() => delete div.dataset.justDragged, 100);
              clearDragOverStates();
              trashDropZone.classList.remove("visible", "drag-over");
              draggedIssue = null;
            });
          }

          itemsEl.appendChild(div);
        });

        // Auto-expand done group when viewing completed sprint, otherwise normal collapse logic
        if (isCompletedSprint && status === "done") {
          group.classList.remove("collapsed");
        } else if (items.length === 0 && !["in_progress", "todo"].includes(status)) {
          group.classList.add("collapsed");
        }
      });

      // Show/hide empty state
      const totalIssues = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);
      issuesEmpty.style.display = totalIssues === 0 ? "block" : "none";
      issuesList.style.display = totalIssues === 0 ? "none" : "flex";
    }

    function renderKanban() {
      // Filter issues by selected sprint
      let filteredIssues = issues;
      if (kanbanSprintFilter === "__backlog__") {
        // Show only backlog (default sprint) issues
        const defaultSprint = sprints.find(s => s.is_default);
        filteredIssues = issues.filter(issue =>
          defaultSprint ? issue.sprint_id === defaultSprint.id : !issue.sprint_id
        );
      } else if (kanbanSprintFilter !== "") {
        // Show only issues from selected sprint
        filteredIssues = issues.filter(issue => issue.sprint_id === kanbanSprintFilter);
      }

      // Apply priority filter
      if (filterPriority) {
        filteredIssues = filteredIssues.filter(issue => issue.priority === filterPriority);
      }

      // Apply tag filter
      if (filterTagId) {
        filteredIssues = filteredIssues.filter(issue => {
          const tagData = issueTags[issue.id] || [];
          return tagData.some(t => t.id === filterTagId);
        });
      }

      // Group filtered issues by status
      const grouped = {
        todo: [],
        in_progress: [],
        review: [],
        done: [],
      };

      filteredIssues.forEach(issue => {
        if (grouped[issue.status]) {
          grouped[issue.status].push(issue);
        }
      });

      // Find sprint names for display
      const sprintMap = {};
      sprints.forEach(s => {
        sprintMap[s.id] = s.name;
      });

      // Render each column
      kanbanColumns.forEach(column => {
        const status = column.dataset.status;
        const items = grouped[status] || [];
        const countEl = column.querySelector(".kanban-column-count");
        const itemsEl = column.querySelector(".kanban-column-items");

        countEl.textContent = items.length;
        itemsEl.innerHTML = "";

        items.forEach(issue => {
          const card = document.createElement("div");
          card.className = "kanban-card";
          card.dataset.id = issue.id;
          card.draggable = true;

          const sprintName = issue.sprint_id ? sprintMap[issue.sprint_id] : "Backlog";

          const cardTagData = issueTags[issue.id] || [];
          const cardTagsHtml = cardTagData.length > 0 ? \`
            <div class="kanban-card-tags">
              \${cardTagData.slice(0, 3).map(tag =>
                \`<span class="kanban-card-tag" style="background: \${tag.color}; color: \${getContrastTextColor(tag.color)}" title="\${escapeHtml(tag.name)}">\${escapeHtml(tag.name)}</span>\`
              ).join('')}
              \${cardTagData.length > 3 ? \`<span class="kanban-card-tags-more">+\${cardTagData.length - 3}</span>\` : ''}
            </div>
          \` : '';

          card.innerHTML = \`
            <div class="kanban-card-header">
              <span class="kanban-card-key">\${issue.key}</span>
              <div class="kanban-card-actions">
                <button class="kanban-card-edit" draggable="false" title="Edit issue">Edit</button>
                <button class="send-to-terminal-btn" draggable="false" title="Send to terminal">Send to Terminal</button>
              </div>
            </div>
            <div class="kanban-card-title">\${issue.title}</div>
            \${cardTagsHtml}
            <div class="kanban-card-meta">
              <span class="kanban-card-priority \${issue.priority}">\${issue.priority}</span>
              <span class="kanban-card-sprint">\${sprintName || ""}</span>
            </div>
          \`;

          // Edit button click (opens detail panel)
          const editBtn = card.querySelector(".kanban-card-edit");
          editBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            openDetailPanel(issue);
          });

          editBtn.addEventListener("mousedown", (e) => {
            e.stopPropagation();
          });

          // Send to Terminal button
          const sendBtn = card.querySelector(".send-to-terminal-btn");
          sendBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            vscode.postMessage({ type: "sendToTerminal", text: \`[\${issue.key}] \${issue.title}\` });
          });

          sendBtn.addEventListener("mousedown", (e) => {
            e.stopPropagation();
          });

          // Click card to open detail panel
          card.addEventListener("click", () => openDetailPanel(issue));

          // Drag events
          card.addEventListener("dragstart", (e) => {
            // Don't start drag if clicking the edit button
            if (e.target.classList.contains("kanban-card-edit")) {
              e.preventDefault();
              return;
            }
            card.classList.add("dragging");
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", issue.id);
            draggedIssue = issue;
            trashDropZone.classList.add("visible");
          });

          card.addEventListener("dragend", () => {
            card.classList.remove("dragging");
            clearKanbanDragOverStates();
            trashDropZone.classList.remove("visible", "drag-over");
            draggedIssue = null;
          });

          itemsEl.appendChild(card);
        });
      });

      // Show/hide empty state
      const totalIssues = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);
      kanbanEmpty.style.display = totalIssues === 0 ? "block" : "none";
      kanbanBoard.style.display = totalIssues === 0 ? "none" : "flex";
    }

    function setupKanbanDropZones() {
      kanbanColumns.forEach(column => {
        const status = column.dataset.status;
        const itemsEl = column.querySelector(".kanban-column-items");

        column.addEventListener("dragover", (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          column.classList.add("drag-over");
        });

        column.addEventListener("dragleave", (e) => {
          // Only remove if leaving the column entirely
          if (!column.contains(e.relatedTarget)) {
            column.classList.remove("drag-over");
          }
        });

        column.addEventListener("drop", (e) => {
          e.preventDefault();
          column.classList.remove("drag-over");

          if (!draggedIssue) return;

          // Update issue status
          vscode.postMessage({
            type: "updateIssue",
            id: draggedIssue.id,
            updates: { status },
          });
        });
      });
    }

    function clearKanbanDragOverStates() {
      kanbanColumns.forEach(column => {
        column.classList.remove("drag-over");
      });
    }

    function addIssue() {
      const title = sanitizeInput(issueTitle.value, 200);
      if (!title) return;

      // Determine sprint for new issue:
      // - If viewing a specific sprint, add to that sprint
      // - If viewing All or Backlog, add to backlog (no sprintId)
      const isSpecificSprint = selectedSprintFilter &&
                               selectedSprintFilter !== "" &&
                               selectedSprintFilter !== "__backlog__";

      // Call real API to create issue
      vscode.postMessage({
        type: "createIssue",
        title,
        priority: issuePriority.value,
        status: "todo",
        sprintId: isSpecificSprint ? selectedSprintFilter : undefined,
      });

      // Clear input and reset priority
      issueTitle.value = "";
      issuePriority.value = "medium";
      issueTitle.focus();
    }

    function openDetailPanel(issue) {
      selectedIssue = issue;
      detailKey.textContent = issue.key;
      detailTitle.value = issue.title || "";
      detailDescription.value = issue.description || "";
      detailStatus.value = issue.status || "backlog";
      detailPriority.value = issue.priority || "medium";
      detailSprint.value = issue.sprint_id || "";
      issueDetail.classList.add("visible");
      detailTitle.focus();
      // Fetch comments for this issue
      commentsList.innerHTML = '<div class="comments-loading">Loading comments...</div>';
      commentInput.value = "";
      vscode.postMessage({ type: "fetchComments", issueId: issue.id });
      // Render tags (from cache or fetch)
      renderIssueTags();
      vscode.postMessage({ type: "fetchIssueTags", issueId: issue.id });
    }

    function renderComments(comments) {
      if (!comments || comments.length === 0) {
        commentsList.innerHTML = '<div class="comments-empty">No comments yet</div>';
        return;
      }
      commentsList.innerHTML = comments.map(comment => {
        const date = new Date(comment.created_at);
        const timeStr = date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        return \`<div class="comment">
          <div class="comment-content">\${escapeHtml(comment.content)}</div>
          <div class="comment-time">\${timeStr}</div>
        </div>\`;
      }).join("");
    }

    function escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }

    // Calculate relative luminance and determine if text should be dark or light
    function getContrastTextColor(hexColor) {
      // Remove # if present
      const hex = hexColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;

      // Calculate relative luminance
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

      // Return dark text for light backgrounds, light text for dark backgrounds
      return luminance > 0.5 ? '#000000' : '#ffffff';
    }

    function addComment() {
      if (!selectedIssue) return;
      const content = sanitizeInput(commentInput.value, 5000);
      if (!content) return;
      vscode.postMessage({
        type: "addComment",
        issueId: selectedIssue.id,
        content,
      });
      commentInput.value = "";
    }

    // ============ TAG FUNCTIONS ============

    // Helper to render quick tag dropdown for issue items
    function getQuickTagDropdownHtml(issueId) {
      if (!tags || tags.length === 0) return '';

      const assignedTags = issueTags[issueId] || [];
      const assignedIds = new Set(assignedTags.map(t => t.id));

      let options = tags.map(tag => {
        const isSelected = assignedIds.has(tag.id);
        return \`
          <div class="quick-tag-option \${isSelected ? 'selected' : ''}" data-tag-id="\${tag.id}" data-issue-id="\${issueId}">
            <span class="tag-dot" style="background: \${tag.color}"></span>
            <span>\${escapeHtml(tag.name)}</span>
            \${isSelected ? '<span class="tag-check">✓</span>' : ''}
          </div>
        \`;
      }).join('');

      if (tags.length === 0) {
        options = '<div class="quick-tag-empty">No tags yet</div>';
      }

      return \`
        <div class="quick-tag-container">
          <button class="quick-tag-btn" data-issue-id="\${issueId}" title="Add/remove tags">🏷</button>
          <div class="quick-tag-popover" data-issue-id="\${issueId}">
            \${options}
          </div>
        </div>
      \`;
    }

    // Helper to render tag badges for issue items
    function getIssueTagsHtml(issueId, maxTags = 3) {
      if (!showTagsOnIssues) return '';

      const tagData = issueTags[issueId] || [];
      if (tagData.length === 0) return '';

      const visibleTags = tagData.slice(0, maxTags);
      const overflow = tagData.length - maxTags;

      let html = '<div class="issue-item-tags">';
      html += visibleTags.map(tag => {
        const textColor = getContrastTextColor(tag.color);
        return \`<span class="issue-item-tag" style="background: \${tag.color}; color: \${textColor}">\${escapeHtml(tag.name)}</span>\`;
      }).join('');
      if (overflow > 0) {
        html += \`<span class="issue-item-tags-overflow">+\${overflow}</span>\`;
      }
      html += '</div>';
      return html;
    }

    function renderIssueTags() {
      if (!selectedIssue) return;
      const tagData = issueTags[selectedIssue.id] || [];
      issueTagsList.innerHTML = tagData.map(tag => {
        const textColor = getContrastTextColor(tag.color);
        return \`
          <span class="tag-badge" style="background: \${tag.color}; color: \${textColor}" data-id="\${tag.id}">
            \${escapeHtml(tag.name)}
            <button class="tag-badge-remove" style="color: \${textColor}" data-id="\${tag.id}" title="Remove tag">×</button>
          </span>
        \`;
      }).join("");

      // Add click handlers for remove buttons
      issueTagsList.querySelectorAll(".tag-badge-remove").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          removeTagFromIssue(btn.dataset.id);
        });
      });
    }

    function renderTagDropdown() {
      const currentTags = issueTags[selectedIssue?.id] || [];
      const currentTagIds = currentTags.map(t => t.id);

      // Filter out already-added tags
      const availableTags = tags.filter(t => !currentTagIds.includes(t.id));

      if (availableTags.length === 0) {
        tagDropdownList.innerHTML = '<div class="tag-dropdown-empty">No more tags</div>';
      } else {
        tagDropdownList.innerHTML = availableTags.map(tag => \`
          <div class="tag-dropdown-item" data-id="\${tag.id}">
            <span class="tag-color-dot" style="background: \${tag.color}"></span>
            <span>\${escapeHtml(tag.name)}</span>
          </div>
        \`).join("");

        // Add click handlers
        tagDropdownList.querySelectorAll(".tag-dropdown-item").forEach(item => {
          item.addEventListener("click", () => {
            addTagToIssue(item.dataset.id);
            tagDropdown.classList.remove("visible");
          });
        });
      }
    }

    function addTagToIssue(tagId) {
      if (!selectedIssue) return;
      vscode.postMessage({
        type: "addTagToIssue",
        issueId: selectedIssue.id,
        tagId,
      });
    }

    function removeTagFromIssue(tagId) {
      if (!selectedIssue) return;
      vscode.postMessage({
        type: "removeTagFromIssue",
        issueId: selectedIssue.id,
        tagId,
      });
    }

    function openTagManagement() {
      tagManagementDialog.classList.add("visible");
      renderTagList();
    }

    function renderTagList() {
      if (tags.length === 0) {
        tagList.innerHTML = \`
          <div class="tag-list-empty">
            <div class="tag-list-empty-icon">🏷️</div>
            <div>No tags yet</div>
            <div style="font-size: 11px; margin-top: 4px; opacity: 0.7;">Create your first tag below</div>
          </div>
        \`;
        return;
      }

      tagList.innerHTML = tags.map(tag => \`
        <div class="tag-list-item" data-id="\${tag.id}">
          <div class="tag-color-wrapper">
            <div class="tag-list-item-color" style="background: \${tag.color}"></div>
            <input type="color" class="tag-edit-color" value="\${tag.color}" title="Change color">
          </div>
          <div class="tag-list-item-info">
            <div class="tag-list-item-name">\${escapeHtml(tag.name)}</div>
          </div>
          <div class="tag-list-item-actions">
            <button class="tag-delete-btn" title="Delete tag">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
              </svg>
            </button>
          </div>
        </div>
      \`).join("");

      // Add event handlers
      tagList.querySelectorAll(".tag-list-item").forEach(item => {
        const tagId = item.dataset.id;

        // Color picker - click on color to change
        const colorWrapper = item.querySelector(".tag-color-wrapper");
        const colorInput = item.querySelector(".tag-edit-color");
        const colorPreview = item.querySelector(".tag-list-item-color");

        colorWrapper.addEventListener("click", () => colorInput.click());
        colorInput.addEventListener("input", (e) => {
          colorPreview.style.background = e.target.value;
        });
        colorInput.addEventListener("change", (e) => {
          vscode.postMessage({
            type: "updateTag",
            tagId,
            updates: { color: e.target.value },
          });
        });

        item.querySelector(".tag-delete-btn").addEventListener("click", (e) => {
          e.stopPropagation();
          if (confirm("Delete this tag? It will be removed from all issues.")) {
            vscode.postMessage({
              type: "deleteTag",
              tagId,
            });
          }
        });
      });
    }

    function createTag() {
      const name = sanitizeInput(newTagName.value, 50);
      const color = newTagColor.value;

      if (!name) {
        newTagName.focus();
        return;
      }

      vscode.postMessage({
        type: "createTag",
        name,
        color,
      });

      newTagName.value = "";
    }

    function closeDetailPanel() {
      selectedIssue = null;
      issueDetail.classList.remove("visible");
    }

    function saveIssue() {
      if (!selectedIssue) return;

      const updates = {
        title: detailTitle.value.trim(),
        description: detailDescription.value.trim(),
        status: detailStatus.value,
        priority: detailPriority.value,
        sprintId: detailSprint.value || null,
      };

      if (!updates.title) {
        detailTitle.focus();
        return;
      }

      vscode.postMessage({
        type: "updateIssue",
        id: selectedIssue.id,
        updates,
      });

      closeDetailPanel();
    }

    function deleteIssue() {
      if (!selectedIssue) return;
      deleteIssueText.textContent = \`Delete issue \${selectedIssue.key}?\`;
      deleteIssueDialog.classList.add("visible");
    }

    function confirmDeleteIssue() {
      if (!selectedIssue) return;
      vscode.postMessage({
        type: "deleteIssue",
        id: selectedIssue.id,
      });
      deleteIssueDialog.classList.remove("visible");
      closeDetailPanel();
    }

    function clearDragOverStates() {
      document.querySelectorAll(".issue-group").forEach(g => {
        g.classList.remove("drag-over");
      });
      document.querySelectorAll(".issue-group-items").forEach(i => {
        i.classList.remove("drag-over");
      });
      document.querySelectorAll(".sprint-tab").forEach(t => {
        t.classList.remove("drag-over");
      });
      if (backlogItems) {
        backlogItems.classList.remove("drag-over");
      }
    }

    function handleDrop(targetStatus, fromBacklog = false) {
      if (!draggedIssue) return;

      // Skip if dropping to same status (unless coming from backlog)
      if (!fromBacklog && draggedIssue.status === targetStatus) {
        return;
      }

      // Build updates - if from backlog, also assign to current sprint
      const updates = { status: targetStatus };
      if (fromBacklog && selectedSprintFilter && selectedSprintFilter !== "__backlog__" && selectedSprintFilter !== "") {
        updates.sprintId = selectedSprintFilter;
      }

      // Update via API
      vscode.postMessage({
        type: "updateIssue",
        id: draggedIssue.id,
        updates,
      });

      if (fromBacklog) {
        // Remove from backlog list and refresh
        backlogIssues = backlogIssues.filter(i => i.id !== draggedIssue.id);
        renderBacklogItems();
        // Re-fetch issues to include the moved issue
        vscode.postMessage({ type: "fetchIssues" });
      } else {
        // Optimistically update local state
        const issue = issues.find(i => i.id === draggedIssue.id);
        if (issue) {
          issue.status = targetStatus;
          renderIssues();
        }
      }
    }

    function setupDropZones() {
      issueGroups.forEach(group => {
        const status = group.dataset.status;
        const itemsEl = group.querySelector(".issue-group-items");

        // Dragover on group
        group.addEventListener("dragover", (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          clearDragOverStates();
          group.classList.add("drag-over");
          itemsEl.classList.add("drag-over");
          // Expand collapsed groups when dragging over
          group.classList.remove("collapsed");
        });

        group.addEventListener("dragleave", (e) => {
          // Only clear if leaving the group entirely
          if (!group.contains(e.relatedTarget)) {
            group.classList.remove("drag-over");
            itemsEl.classList.remove("drag-over");
          }
        });

        group.addEventListener("drop", (e) => {
          e.preventDefault();
          clearDragOverStates();
          // Check if dropped from backlog section
          const fromBacklog = e.dataTransfer.getData("fromBacklog") === "true" ||
                              (draggedIssue && backlogIssues.some(i => i.id === draggedIssue.id));
          handleDrop(status, fromBacklog);
        });
      });
    }

    // Sprint functions
    function populateSprintTabs() {
      // Clear existing tabs
      sprintTabs.innerHTML = '';

      if (viewingDone) {
        // Show only completed sprints
        const completedSprints = sprints.filter(s => s.status === 'completed');

        if (completedSprints.length === 0) {
          const emptyMsg = document.createElement("span");
          emptyMsg.className = "sprint-tab-empty";
          emptyMsg.textContent = "No completed sprints";
          emptyMsg.style.color = "var(--vscode-descriptionForeground)";
          emptyMsg.style.fontStyle = "italic";
          emptyMsg.style.padding = "5px 12px";
          sprintTabs.appendChild(emptyMsg);
        } else {
          completedSprints.forEach((sprint, index) => {
            const tab = document.createElement("button");
            tab.className = "sprint-tab" + (index === 0 && selectedSprintFilter === "" ? " active" : "");
            tab.className = "sprint-tab" + (selectedSprintFilter === sprint.id ? " active" : "");
            tab.dataset.sprint = sprint.id;
            tab.textContent = sprint.name;
            tab.addEventListener("click", () => selectSprintTab(sprint.id));
            // Right-click context menu for reactivation
            tab.addEventListener("contextmenu", (e) => showSprintContextMenu(e, sprint.id));
            sprintTabs.appendChild(tab);
          });
        }
      } else {
        // Add "All" tab
        const allTab = document.createElement("button");
        allTab.className = "sprint-tab" + (selectedSprintFilter === "" ? " active" : "");
        allTab.dataset.sprint = "";
        allTab.textContent = "All";
        allTab.addEventListener("click", () => selectSprintTab(""));
        setupSprintTabDropZone(allTab);
        sprintTabs.appendChild(allTab);

        // Add "Backlog" tab
        const backlogTab = document.createElement("button");
        backlogTab.className = "sprint-tab" + (selectedSprintFilter === "__backlog__" ? " active" : "");
        backlogTab.dataset.sprint = "__backlog__";
        backlogTab.textContent = "Backlog";
        backlogTab.addEventListener("click", () => selectSprintTab("__backlog__"));
        setupSprintTabDropZone(backlogTab);
        sprintTabs.appendChild(backlogTab);

        // Add active sprint tabs (non-default, non-completed sprints)
        sprints.forEach(sprint => {
          // Skip the default Backlog sprint and completed sprints
          if (sprint.is_default || sprint.status === 'completed') return;

          const tab = document.createElement("button");
          tab.className = "sprint-tab" + (selectedSprintFilter === sprint.id ? " active" : "");
          tab.dataset.sprint = sprint.id;
          tab.textContent = sprint.name;
          tab.addEventListener("click", () => selectSprintTab(sprint.id));
          // Right-click context menu
          tab.addEventListener("contextmenu", (e) => showSprintContextMenu(e, sprint.id));
          setupSprintTabDropZone(tab);
          sprintTabs.appendChild(tab);
        });
      }

      // Detail panel sprint dropdown (exclude completed sprints)
      detailSprint.innerHTML = '<option value="">No Sprint (Backlog)</option>';
      sprints.forEach(sprint => {
        if (sprint.status === 'completed') return;
        const opt = document.createElement("option");
        opt.value = sprint.id;
        opt.textContent = sprint.name;
        detailSprint.appendChild(opt);
      });
    }

    function populateKanbanSprintTabs() {
      kanbanSprintTabs.innerHTML = '';

      // Add "All" tab
      const allTab = document.createElement("button");
      allTab.className = "sprint-tab" + (kanbanSprintFilter === "" ? " active" : "");
      allTab.dataset.sprint = "";
      allTab.textContent = "All";
      allTab.addEventListener("click", () => selectKanbanSprintTab(""));
      kanbanSprintTabs.appendChild(allTab);

      // Add "Backlog" tab
      const backlogTab = document.createElement("button");
      backlogTab.className = "sprint-tab" + (kanbanSprintFilter === "__backlog__" ? " active" : "");
      backlogTab.dataset.sprint = "__backlog__";
      backlogTab.textContent = "Backlog";
      backlogTab.addEventListener("click", () => selectKanbanSprintTab("__backlog__"));
      kanbanSprintTabs.appendChild(backlogTab);

      // Add active sprint tabs (non-default, non-completed sprints)
      sprints.forEach(sprint => {
        if (sprint.is_default || sprint.status === 'completed') return;

        const tab = document.createElement("button");
        tab.className = "sprint-tab" + (kanbanSprintFilter === sprint.id ? " active" : "");
        tab.dataset.sprint = sprint.id;
        tab.textContent = sprint.name;
        tab.addEventListener("click", () => selectKanbanSprintTab(sprint.id));
        kanbanSprintTabs.appendChild(tab);
      });
    }

    function selectKanbanSprintTab(sprintId) {
      kanbanSprintFilter = sprintId;
      // Update active tab styling
      kanbanSprintTabs.querySelectorAll(".sprint-tab").forEach(tab => {
        tab.classList.toggle("active", tab.dataset.sprint === sprintId);
      });
      renderKanban();
    }

    function toggleDoneView() {
      viewingDone = !viewingDone;
      doneTabBtn.classList.toggle("active", viewingDone);
      issuesSection.classList.toggle("viewing-done", viewingDone);

      // Reset sprint filter and clear backlog
      selectedSprintFilter = "";
      backlogSection.classList.add("hidden");
      backlogIssues = [];

      // Repopulate tabs and re-render issues
      populateSprintTabs();
      renderIssues();

      // Select first completed sprint if viewing done
      if (viewingDone) {
        const completedSprints = sprints.filter(s => s.status === 'completed');
        if (completedSprints.length > 0) {
          selectSprintTab(completedSprints[0].id);
        }
      }
    }

    function selectSprintTab(sprintId) {
      selectedSprintFilter = sprintId;
      // Update active state on tabs
      sprintTabs.querySelectorAll(".sprint-tab").forEach(tab => {
        tab.classList.toggle("active", tab.dataset.sprint === sprintId);
      });

      // Show/hide backlog section based on selected tab
      // Show backlog section when viewing a specific sprint (not All or Backlog)
      const isSpecificSprint = sprintId && sprintId !== "__backlog__" && sprintId !== "";
      if (isSpecificSprint) {
        backlogSection.classList.remove("hidden");
        // Fetch backlog issues for this sprint's project
        vscode.postMessage({ type: "fetchBacklogIssues", sprintId });
      } else {
        backlogSection.classList.add("hidden");
        backlogIssues = [];
      }

      renderIssues();
    }

    function setupSprintTabDropZone(tab) {
      tab.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        tab.classList.add("drag-over");
      });

      tab.addEventListener("dragleave", () => {
        tab.classList.remove("drag-over");
      });

      tab.addEventListener("drop", (e) => {
        e.preventDefault();
        tab.classList.remove("drag-over");

        if (!draggedIssue) return;

        const targetSprintId = tab.dataset.sprint;
        // Can't drop on "All" tab (it's just a filter)
        if (targetSprintId === "") return;

        // "__backlog__" means remove from sprint
        const newSprintId = targetSprintId === "__backlog__" ? null : targetSprintId;

        // Don't do anything if dropping on same sprint
        const currentSprintId = draggedIssue.sprint_id || null;
        if (newSprintId === currentSprintId) return;

        // Update via API
        vscode.postMessage({
          type: "updateIssue",
          id: draggedIssue.id,
          updates: { sprintId: newSprintId },
        });

        // Optimistically update local state
        const issue = issues.find(i => i.id === draggedIssue.id);
        if (issue) {
          issue.sprint_id = newSprintId;
          renderIssues();
        }
      });
    }

    function getFilteredIssues() {
      let filtered = issues;

      // Filter by sprint
      if (selectedSprintFilter) {
        const defaultSprint = sprints.find(s => s.is_default);
        if (selectedSprintFilter === "__backlog__") {
          filtered = defaultSprint
            ? filtered.filter(i => i.sprint_id === defaultSprint.id)
            : filtered.filter(i => !i.sprint_id);
        } else {
          filtered = filtered.filter(i => i.sprint_id === selectedSprintFilter);
        }
      }

      // Filter by priority
      if (filterPriority) {
        filtered = filtered.filter(i => i.priority === filterPriority);
      }

      // Filter by tag
      if (filterTagId) {
        filtered = filtered.filter(i => {
          const tagData = issueTags[i.id] || [];
          return tagData.some(t => t.id === filterTagId);
        });
      }

      return filtered;
    }

    function updateFilterTagOptions() {
      // Preserve current selection
      const currentValue = filterTagSelect.value;

      // Clear existing options except first (both dropdowns)
      filterTagSelect.innerHTML = '<option value="">All Tags</option>';
      kanbanFilterTagSelect.innerHTML = '<option value="">All Tags</option>';

      // Add tag options to both dropdowns
      tags.forEach(tag => {
        const option1 = document.createElement("option");
        option1.value = tag.id;
        option1.textContent = tag.name;
        option1.style.color = tag.color;
        filterTagSelect.appendChild(option1);

        const option2 = document.createElement("option");
        option2.value = tag.id;
        option2.textContent = tag.name;
        option2.style.color = tag.color;
        kanbanFilterTagSelect.appendChild(option2);
      });

      // Restore selection if still valid (both dropdowns)
      if (tags.some(t => t.id === currentValue)) {
        filterTagSelect.value = currentValue;
        kanbanFilterTagSelect.value = currentValue;
      }
    }

    function renderBacklogItems() {
      backlogCount.textContent = backlogIssues.length;
      backlogItems.innerHTML = "";

      if (backlogIssues.length === 0) {
        backlogItems.innerHTML = '<div class="empty-backlog">No items in backlog</div>';
        return;
      }

      backlogIssues.forEach(issue => {
        const div = document.createElement("div");
        div.className = "issue-item";
        div.dataset.id = issue.id;
        div.draggable = true;
        div.innerHTML = \`
          <span class="issue-key">\${issue.key}</span>
          <span class="issue-title">\${issue.title}</span>
          \${getQuickTagDropdownHtml(issue.id)}
          \${getIssueTagsHtml(issue.id)}
          <span class="issue-priority \${issue.priority}">\${issue.priority}</span>
        \`;

        // Quick tag dropdown
        const quickTagBtn = div.querySelector(".quick-tag-btn");
        const quickTagPopover = div.querySelector(".quick-tag-popover");
        if (quickTagBtn && quickTagPopover) {
          quickTagBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            document.querySelectorAll(".quick-tag-popover.visible").forEach(p => {
              if (p !== quickTagPopover) p.classList.remove("visible");
            });
            // Position the popover below the button
            const rect = quickTagBtn.getBoundingClientRect();
            quickTagPopover.style.top = (rect.bottom + 4) + "px";
            quickTagPopover.style.left = rect.left + "px";
            quickTagPopover.classList.toggle("visible");
          });

          quickTagPopover.querySelectorAll(".quick-tag-option").forEach(opt => {
            opt.addEventListener("click", (e) => {
              e.stopPropagation();
              const tagId = opt.dataset.tagId;
              const issueId = opt.dataset.issueId;
              const isSelected = opt.classList.contains("selected");

              if (isSelected) {
                vscode.postMessage({ type: "removeTagFromIssue", issueId, tagId });
              } else {
                vscode.postMessage({ type: "addTagToIssue", issueId, tagId });
              }
              quickTagPopover.classList.remove("visible");
            });
          });
        }

        // Enable drag from backlog to sprint
        div.addEventListener("dragstart", (e) => {
          div.classList.add("dragging");
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", issue.id);
          e.dataTransfer.setData("fromBacklog", "true");
          draggedIssue = issue;
          trashDropZone.classList.add("visible");
        });

        div.addEventListener("dragend", () => {
          div.classList.remove("dragging");
          clearDragOverStates();
          trashDropZone.classList.remove("visible", "drag-over");
          draggedIssue = null;
        });

        div.addEventListener("click", () => openDetailPanel(issue));

        backlogItems.appendChild(div);
      });
    }

    function toggleBacklogExpanded() {
      backlogExpanded = !backlogExpanded;
      backlogSection.classList.toggle("expanded", backlogExpanded);
    }

    // Context menu functions
    function showSprintContextMenu(e, sprintId) {
      e.preventDefault();
      contextMenuSprintId = sprintId;

      const sprint = sprints.find(s => s.id === sprintId);
      const isCompleted = sprint?.status === 'completed';

      // Show/hide relevant menu items based on sprint status
      const editItem = sprintContextMenu.querySelector('[data-action="edit"]');
      const completeItem = sprintContextMenu.querySelector('[data-action="complete"]');
      const reactivateItem = sprintContextMenu.querySelector('[data-action="reactivate"]');

      editItem.style.display = isCompleted ? 'none' : 'block';
      completeItem.style.display = isCompleted ? 'none' : 'block';
      reactivateItem.style.display = isCompleted ? 'block' : 'none';

      // Position the menu at cursor
      sprintContextMenu.style.left = e.pageX + "px";
      sprintContextMenu.style.top = e.pageY + "px";
      sprintContextMenu.classList.add("visible");
    }

    function hideSprintContextMenu() {
      sprintContextMenu.classList.remove("visible");
      // Don't clear contextMenuSprintId here - dialogs may still need it
    }

    function handleContextMenuAction(action) {
      if (!contextMenuSprintId) return;

      const sprint = sprints.find(s => s.id === contextMenuSprintId);
      if (!sprint) return;

      switch (action) {
        case "edit":
          showEditSprintDialog(sprint);
          break;
        case "complete":
          showCompleteSprintDialog(sprint);
          break;
        case "reactivate":
          reactivateSprint(sprint);
          break;
        case "delete":
          showDeleteSprintDialog(sprint);
          break;
      }

      hideSprintContextMenu();
    }

    function reactivateSprint(sprint) {
      vscode.postMessage({
        type: "reactivateSprint",
        sprintId: sprint.id,
      });
    }

    // Edit sprint dialog
    function showEditSprintDialog(sprint) {
      editSprintName.value = sprint.name;
      editSprintDialog.classList.add("visible");
      editSprintName.focus();
      editSprintName.select();
    }

    function hideEditSprintDialog() {
      editSprintDialog.classList.remove("visible");
      editSprintName.value = "";
    }

    function saveSprintEdit() {
      const name = editSprintName.value.trim();
      if (!name || !contextMenuSprintId) return;

      vscode.postMessage({
        type: "updateSprint",
        sprintId: contextMenuSprintId,
        name,
      });

      hideEditSprintDialog();
      contextMenuSprintId = null;
    }

    // Delete sprint dialog
    function showDeleteSprintDialog(sprint) {
      deleteSprintDialog.classList.add("visible");
    }

    function hideDeleteSprintDialog() {
      deleteSprintDialog.classList.remove("visible");
    }

    function confirmDeleteSprint() {
      if (!contextMenuSprintId) return;

      const moveToBacklog = document.querySelector('input[name="delete-action"]:checked').value === "move";

      vscode.postMessage({
        type: "deleteSprint",
        sprintId: contextMenuSprintId,
        moveToBacklog,
      });

      hideDeleteSprintDialog();
      contextMenuSprintId = null;
    }

    // Complete sprint dialog
    function showCompleteSprintDialog(sprint) {
      completeSprintDialog.classList.add("visible");
    }

    function hideCompleteSprintDialog() {
      completeSprintDialog.classList.remove("visible");
    }

    function confirmCompleteSprint() {
      if (!contextMenuSprintId) return;

      const moveIncomplete = document.querySelector('input[name="complete-action"]:checked').value === "move";

      vscode.postMessage({
        type: "completeSprint",
        sprintId: contextMenuSprintId,
        moveIncomplete,
      });

      hideCompleteSprintDialog();
      contextMenuSprintId = null;
    }

    function showSprintCreate() {
      newSprintBtn.style.display = "none";
      sprintCreate.classList.add("visible");
      sprintName.value = "";
      sprintName.focus();
    }

    function hideSprintCreate() {
      sprintCreate.classList.remove("visible");
      newSprintBtn.style.display = "";
      sprintName.value = "";
    }

    function createSprint() {
      const name = sanitizeInput(sprintName.value, 100);
      if (!name) return;

      vscode.postMessage({
        type: "createSprint",
        name,
      });

      hideSprintCreate();
    }

    function startEdit(li, todo) {
      const label = li.querySelector("label");
      if (!label) return;

      const editInput = document.createElement("input");
      editInput.type = "text";
      editInput.className = "edit-input";
      editInput.value = todo.text;

      label.replaceWith(editInput);
      editInput.focus();
      editInput.select();

      function saveEdit() {
        const newText = editInput.value.trim();
        if (newText && newText !== todo.text) {
          vscode.postMessage({ type: "edit", id: todo.id, text: newText });
        } else {
          // Restore original label if no change
          const newLabel = document.createElement("label");
          newLabel.textContent = todo.text;
          newLabel.addEventListener("click", () => startEdit(li, todo));
          editInput.replaceWith(newLabel);
        }
      }

      editInput.addEventListener("blur", saveEdit);
      editInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          editInput.blur();
        } else if (e.key === "Escape") {
          editInput.value = todo.text; // Reset to original
          editInput.blur();
        }
      });
    }

    function render(todos) {
      list.textContent = "";

      if (!todos || todos.length === 0) {
        empty.style.display = "block";
      } else {
        empty.style.display = "none";
      }

      todos.forEach((todo) => {
        const li = document.createElement("li");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.setAttribute("aria-label", "Complete todo");
        checkbox.addEventListener("change", () => {
          vscode.postMessage({ type: "toggle", id: todo.id });
          showUndoBar();
        });

        const label = document.createElement("label");
        label.textContent = todo.text;
        label.setAttribute("title", "Click to edit");
        label.addEventListener("click", () => startEdit(li, todo));

        const sendBtn = document.createElement("button");
        sendBtn.className = "send-to-terminal-btn";
        sendBtn.textContent = "Send to Terminal";
        sendBtn.title = "Send this task to the terminal";
        sendBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          vscode.postMessage({ type: "sendToTerminal", text: "Todo: " + todo.text });
        });

        li.appendChild(checkbox);
        li.appendChild(label);
        li.appendChild(sendBtn);
        list.appendChild(li);
      });
    }

    /**
     * Render unassigned (legacy) todos that need to be migrated to workspace
     */
    function renderUnassignedTodos(todos) {
      unassignedList.textContent = "";

      if (!todos || todos.length === 0) {
        unassignedSection.classList.remove("visible");
        return;
      }

      unassignedSection.classList.add("visible");

      todos.forEach((todo) => {
        const li = document.createElement("li");

        const label = document.createElement("label");
        label.textContent = todo.text;
        label.style.cursor = "default";

        li.appendChild(label);
        unassignedList.appendChild(li);
      });
    }

    // Migrate button click handler
    migrateBtn.addEventListener("click", () => {
      vscode.postMessage({ type: "migrateUnassignedTodos" });
    });

    function addTodo() {
      const text = sanitizeInput(input.value, 500);
      if (!text) {
        return;
      }

      vscode.postMessage({ type: "add", text });
      input.value = "";
      input.focus();
      hideUndoBar(); // Hide undo bar when adding new todo
    }

    signInBtn.addEventListener("click", () => {
      vscode.postMessage({ type: "signIn" });
    });

    signOutBtn.addEventListener("click", () => {
      vscode.postMessage({ type: "signOut" });
    });

    authOpenBtn.addEventListener("click", () => {
      vscode.postMessage({ type: "authOpenLink" });
    });

    authCopyBtn.addEventListener("click", () => {
      vscode.postMessage({ type: "authCopyCode" });
    });

    resolveAllLocal.addEventListener("click", () => {
      vscode.postMessage({ type: "resolveAllConflicts", resolution: "keep_local" });
    });

    resolveAllRemote.addEventListener("click", () => {
      vscode.postMessage({ type: "resolveAllConflicts", resolution: "keep_remote" });
    });

    upgradeBtn.addEventListener("click", () => {
      vscode.postMessage({ type: "openUpgrade" });
    });

    mcpLink.addEventListener("click", (e) => {
      e.preventDefault();
      vscode.postMessage({ type: "openMcpInfo" });
    });

    // Dev toolbar buttons
    devButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        vscode.postMessage({ type: "devSetTier", tier: btn.dataset.tier });
      });
    });

    // Tab event listeners
    tabTodos.addEventListener("click", () => switchTab("todos"));
    tabIssues.addEventListener("click", () => switchTab("issues"));
    tabKanban.addEventListener("click", () => switchTab("kanban"));
    tabAccount.addEventListener("click", () => switchTab("account"));

    // Account event listeners
    exportDataBtn.addEventListener("click", () => {
      exportDataBtn.classList.add("loading");
      exportDataBtn.disabled = true;
      exportDataBtn.textContent = "Exporting...";
      vscode.postMessage({ type: "exportData" });
    });

    deleteAccountBtn.addEventListener("click", () => {
      deleteAccountDialog.classList.remove("hidden");
      deleteConfirmText.value = "";
      deleteAccountConfirm.disabled = true;
    });

    deleteConfirmText.addEventListener("input", () => {
      deleteAccountConfirm.disabled = deleteConfirmText.value !== "DELETE";
    });

    deleteAccountCancel.addEventListener("click", () => {
      deleteAccountDialog.classList.add("hidden");
    });

    deleteAccountConfirm.addEventListener("click", () => {
      if (deleteConfirmText.value === "DELETE") {
        deleteAccountConfirm.classList.add("loading");
        deleteAccountConfirm.disabled = true;
        deleteAccountConfirm.textContent = "Deleting...";
        vscode.postMessage({ type: "deleteAccount" });
      }
    });

    privacyLink.addEventListener("click", () => {
      vscode.postMessage({ type: "openLink", url: "https://panel-todo.com/privacy" });
    });

    termsLink.addEventListener("click", () => {
      vscode.postMessage({ type: "openLink", url: "https://panel-todo.com/terms" });
    });

    docsLink.addEventListener("click", () => {
      vscode.postMessage({ type: "openLink", url: "https://panel-todo.com/docs" });
    });

    todosHelpLink.addEventListener("click", () => {
      vscode.postMessage({ type: "openLink", url: "https://panel-todo.com/docs/where-local-todos-stored" });
    });

    mcpSetupLink.addEventListener("click", () => {
      vscode.postMessage({ type: "openLink", url: "https://panel-todo.com/docs/installing-mcp-server" });
    });

    // MCP Token event listeners
    createTokenBtn.addEventListener("click", () => {
      const name = tokenNameInput.value.trim();
      if (!name) {
        tokenNameInput.focus();
        return;
      }
      createTokenBtn.disabled = true;
      createTokenBtn.textContent = "Creating...";
      vscode.postMessage({ type: "createApiToken", name });
    });

    tokenNameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        createTokenBtn.click();
      }
    });

    copyNewTokenBtn.addEventListener("click", () => {
      const token = mcpTokenCreatedValue.textContent;
      if (token) {
        navigator.clipboard.writeText(token);
        copyNewTokenBtn.textContent = "Copied!";
        setTimeout(() => {
          copyNewTokenBtn.textContent = "Copy Token";
        }, 2000);
      }
    });

    dismissNewTokenBtn.addEventListener("click", () => {
      mcpTokenCreatedBanner.classList.remove("visible");
      mcpTokenCreatedValue.textContent = "";
    });

    // Issue event listeners
    addIssueBtn.addEventListener("click", addIssue);
    issueTitle.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addIssue();
    });

    // Detail panel event listeners
    detailClose.addEventListener("click", closeDetailPanel);
    detailCancel.addEventListener("click", closeDetailPanel);
    detailSave.addEventListener("click", saveIssue);
    detailDelete.addEventListener("click", deleteIssue);
    detailTitle.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDetailPanel();
    });
    addCommentBtn.addEventListener("click", addComment);
    commentInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addComment();
    });

    // Tag event listeners
    addTagBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      tagDropdown.classList.toggle("visible");
      if (tagDropdown.classList.contains("visible")) {
        renderTagDropdown();
      }
    });

    manageTagsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      tagDropdown.classList.remove("visible");
      openTagManagement();
    });

    createTagBtn.addEventListener("click", createTag);
    newTagName.addEventListener("keydown", (e) => {
      if (e.key === "Enter") createTag();
    });

    // Color picker syncs with preview
    newTagColor.addEventListener("input", (e) => {
      tagColorPreview.style.background = e.target.value;
      // Deselect all preset colors
      tagPresetColors.querySelectorAll(".tag-preset-color").forEach(p => p.classList.remove("selected"));
    });

    // Preset color selection
    tagPresetColors.addEventListener("click", (e) => {
      const preset = e.target.closest(".tag-preset-color");
      if (!preset) return;

      const color = preset.dataset.color;
      newTagColor.value = color;
      tagColorPreview.style.background = color;

      // Update selected state
      tagPresetColors.querySelectorAll(".tag-preset-color").forEach(p => p.classList.remove("selected"));
      preset.classList.add("selected");
    });

    tagManagementClose.addEventListener("click", () => {
      tagManagementDialog.classList.remove("visible");
    });

    tagManagementDialog.addEventListener("click", (e) => {
      if (e.target === tagManagementDialog) {
        tagManagementDialog.classList.remove("visible");
      }
    });

    // Close tag dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (!tagDropdown.contains(e.target) && e.target !== addTagBtn) {
        tagDropdown.classList.remove("visible");
      }
      // Also close quick tag popovers
      if (!e.target.closest(".quick-tag-container")) {
        document.querySelectorAll(".quick-tag-popover.visible").forEach(p => {
          p.classList.remove("visible");
        });
      }
    });

    // Issue group collapse toggle
    issueGroups.forEach(group => {
      const header = group.querySelector(".issue-group-header");
      header.addEventListener("click", (e) => {
        // Don't toggle if clicking on an issue item
        if (e.target.closest(".issue-item")) return;
        group.classList.toggle("collapsed");
      });
    });

    // Sprint event listeners
    newSprintBtn.addEventListener("click", showSprintCreate);
    sprintSaveBtn.addEventListener("click", createSprint);
    sprintName.addEventListener("keydown", (e) => {
      if (e.key === "Enter") createSprint();
      if (e.key === "Escape") hideSprintCreate();
    });
    doneTabBtn.addEventListener("click", toggleDoneView);

    // Filter event handlers (synced between Issues and Kanban views)
    function syncTagsToggle(active) {
      showTagsOnIssues = active;
      tagsToggleBtn.classList.toggle("active", showTagsOnIssues);
      kanbanTagsToggleBtn.classList.toggle("active", showTagsOnIssues);
      renderIssues();
      renderKanban();
      renderBacklogItems();
    }

    function syncPriorityFilter(value) {
      filterPriority = value;
      filterPrioritySelect.value = value;
      kanbanFilterPrioritySelect.value = value;
      filterPrioritySelect.classList.toggle("has-filter", !!filterPriority);
      kanbanFilterPrioritySelect.classList.toggle("has-filter", !!filterPriority);
      renderIssues();
      renderKanban();
    }

    function syncTagFilter(value) {
      filterTagId = value;
      filterTagSelect.value = value;
      kanbanFilterTagSelect.value = value;
      filterTagSelect.classList.toggle("has-filter", !!filterTagId);
      kanbanFilterTagSelect.classList.toggle("has-filter", !!filterTagId);
      renderIssues();
      renderKanban();
    }

    tagsToggleBtn.addEventListener("click", () => {
      syncTagsToggle(!showTagsOnIssues);
    });

    kanbanTagsToggleBtn.addEventListener("click", () => {
      syncTagsToggle(!showTagsOnIssues);
    });

    filterPrioritySelect.addEventListener("change", () => {
      syncPriorityFilter(filterPrioritySelect.value);
    });

    kanbanFilterPrioritySelect.addEventListener("change", () => {
      syncPriorityFilter(kanbanFilterPrioritySelect.value);
    });

    filterTagSelect.addEventListener("change", () => {
      syncTagFilter(filterTagSelect.value);
    });

    kanbanFilterTagSelect.addEventListener("change", () => {
      syncTagFilter(kanbanFilterTagSelect.value);
    });

    // Click outside sprint create to close it
    document.addEventListener("click", (e) => {
      if (sprintCreate.classList.contains("visible") &&
          !sprintCreate.contains(e.target) &&
          e.target !== newSprintBtn) {
        hideSprintCreate();
      }
    });

    // Backlog section event listeners
    backlogHeader.addEventListener("click", toggleBacklogExpanded);

    // Context menu event listeners
    document.addEventListener("click", (e) => {
      // Hide context menu when clicking outside
      if (!sprintContextMenu.contains(e.target)) {
        hideSprintContextMenu();
      }
    });

    sprintContextMenu.querySelectorAll(".context-menu-item").forEach(item => {
      item.addEventListener("click", () => {
        handleContextMenuAction(item.dataset.action);
      });
    });

    // Edit sprint dialog event listeners
    editSprintCancel.addEventListener("click", hideEditSprintDialog);
    editSprintSave.addEventListener("click", saveSprintEdit);
    editSprintName.addEventListener("keydown", (e) => {
      if (e.key === "Enter") saveSprintEdit();
      if (e.key === "Escape") hideEditSprintDialog();
    });
    editSprintDialog.addEventListener("click", (e) => {
      if (e.target === editSprintDialog) hideEditSprintDialog();
    });

    // Delete sprint dialog event listeners
    deleteSprintCancel.addEventListener("click", hideDeleteSprintDialog);
    deleteSprintConfirm.addEventListener("click", confirmDeleteSprint);
    deleteSprintDialog.addEventListener("click", (e) => {
      if (e.target === deleteSprintDialog) hideDeleteSprintDialog();
    });

    // Complete sprint dialog event listeners
    completeSprintCancel.addEventListener("click", hideCompleteSprintDialog);
    completeSprintConfirm.addEventListener("click", confirmCompleteSprint);
    completeSprintDialog.addEventListener("click", (e) => {
      if (e.target === completeSprintDialog) hideCompleteSprintDialog();
    });

    // Delete issue dialog event listeners
    deleteIssueCancel.addEventListener("click", () => deleteIssueDialog.classList.remove("visible"));
    deleteIssueConfirm.addEventListener("click", confirmDeleteIssue);
    deleteIssueDialog.addEventListener("click", (e) => {
      if (e.target === deleteIssueDialog) deleteIssueDialog.classList.remove("visible");
    });

    // Initialize drag-and-drop zones
    setupDropZones();
    setupKanbanDropZones();

    // Trash drop zone event listeners
    trashDropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      trashDropZone.classList.add("drag-over");
    });

    trashDropZone.addEventListener("dragleave", () => {
      trashDropZone.classList.remove("drag-over");
    });

    trashDropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      trashDropZone.classList.remove("drag-over", "visible");
      if (draggedIssue) {
        deleteIssueText.textContent = \`Delete issue \${draggedIssue.key}?\`;
        selectedIssue = draggedIssue;
        deleteIssueDialog.classList.add("visible");
      }
    });

    addBtn.addEventListener("click", addTodo);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        addTodo();
      }
    });

    undoBtn.addEventListener("click", () => {
      vscode.postMessage({ type: "undo" });
      hideUndoBar();
    });

    window.addEventListener("message", (event) => {
      const message = event.data;
      if (!message) return;

      switch (message.type) {
        case "todos":
          render(message.todos);
          break;
        case "unassignedTodos":
          renderUnassignedTodos(message.todos);
          break;
        case "authState":
          renderAuthState(message);
          break;
        case "connectionState":
          renderConnectionState(message.connected);
          break;
        case "syncState":
          renderSyncState(message.syncing);
          break;
        case "conflicts":
          renderConflicts(message.conflicts);
          break;
        case "focusInput":
          input.focus();
          break;
        case "issues":
          issues = message.issues || [];
          renderIssues();
          if (currentTab === "kanban") {
            renderKanban();
          }
          break;
        case "sprints":
          sprints = message.sprints || [];
          populateSprintTabs();
          populateKanbanSprintTabs();
          if (currentTab === "kanban") {
            renderKanban();
          }
          break;
        case "backlogIssues":
          backlogIssues = message.issues || [];
          renderBacklogItems();
          break;
        case "comments":
          if (selectedIssue && message.issueId === selectedIssue.id) {
            renderComments(message.comments || []);
          }
          break;
        case "projects":
          projects = message.projects || [];
          currentProjectId = message.currentProjectId || null;
          renderProjectSelector();
          break;
        case "tags":
          tags = message.tags || [];
          updateFilterTagOptions();
          // Re-render tag list if management dialog is open
          if (tagManagementDialog.classList.contains("visible")) {
            renderTagList();
          }
          break;
        case "issueTags":
          issueTags[message.issueId] = message.tags || [];
          // Re-render if viewing this issue
          if (selectedIssue && message.issueId === selectedIssue.id) {
            renderIssueTags();
          }
          // Re-render issue lists to show tag dots
          renderIssues();
          renderKanban();
          renderBacklogItems();
          break;
        case "tagAdded":
          // Add tag to local cache
          if (!issueTags[message.issueId]) {
            issueTags[message.issueId] = [];
          }
          issueTags[message.issueId].push(message.tag);
          if (selectedIssue && message.issueId === selectedIssue.id) {
            renderIssueTags();
          }
          // Re-render issue lists to show tag dots
          renderIssues();
          renderKanban();
          renderBacklogItems();
          break;
        case "tagRemoved":
          // Remove tag from local cache
          if (issueTags[message.issueId]) {
            issueTags[message.issueId] = issueTags[message.issueId].filter(t => t.id !== message.tagId);
          }
          if (selectedIssue && message.issueId === selectedIssue.id) {
            renderIssueTags();
          }
          // Re-render issue lists to show updated tag dots
          renderIssues();
          renderKanban();
          renderBacklogItems();
          break;
        case "userInfo":
          // Update user email for account section
          currentUserEmail = message.email || null;
          if (currentTab === "account") {
            updateAccountInfo();
          }
          break;
        case "dataExport":
          // Reset export button
          exportDataBtn.classList.remove("loading");
          exportDataBtn.disabled = false;
          exportDataBtn.textContent = "Export";
          // Trigger download
          if (message.data) {
            const blob = new Blob([JSON.stringify(message.data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "panel-todo-export-" + new Date().toISOString().split("T")[0] + ".json";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
          break;
        case "dataExportError":
          // Reset export button and show error
          exportDataBtn.classList.remove("loading");
          exportDataBtn.disabled = false;
          exportDataBtn.textContent = "Export";
          break;
        case "deleteAccountSuccess":
          // Account deleted - close dialog
          deleteAccountDialog.classList.add("hidden");
          deleteAccountConfirm.classList.remove("loading");
          deleteAccountConfirm.textContent = "Delete My Account";
          // Switch back to todos (extension will handle sign out)
          switchTab("todos");
          break;
        case "deleteAccountError":
          // Reset delete button and show error
          deleteAccountConfirm.classList.remove("loading");
          deleteAccountConfirm.disabled = false;
          deleteAccountConfirm.textContent = "Delete My Account";
          break;

        // MCP Token messages
        case "apiTokens":
          renderApiTokens(message.tokens || []);
          break;
        case "apiTokenCreated":
          // Reset create button and input
          createTokenBtn.disabled = false;
          createTokenBtn.textContent = "Create";
          tokenNameInput.value = "Panel Todo MCP";
          // Show the created token banner
          if (message.token) {
            mcpTokenCreatedValue.textContent = message.token;
            mcpTokenCreatedBanner.classList.add("visible");
          }
          break;
        case "apiTokenRevoked":
          // Token was revoked, list will be refreshed by apiTokens message
          break;
        case "error":
          // Show error message and reset any loading states
          if (message.error) {
            // Reset token create button if it was loading
            createTokenBtn.disabled = false;
            createTokenBtn.textContent = "Create";
            // Show the error (could be enhanced with a toast later)
            alert(message.error);
          }
          break;
      }
    });

    vscode.postMessage({ type: "ready" });
  </script>
</body>
</html>`;
}

