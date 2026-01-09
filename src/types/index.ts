import * as vscode from 'vscode';

// ============================================
// Storage Keys
// ============================================

export const STORAGE_KEYS = {
  ITEMS: 'panelTodo.items',
  MCP_MIGRATED: 'panelTodo.mcpMigrated',
  ACCESS_TOKEN: 'panelTodo.auth.accessToken',
  REFRESH_TOKEN: 'panelTodo.auth.refreshToken',
  LAST_SYNC_TIME: 'panelTodo.lastSyncTime',
  PENDING_SYNC: 'panelTodo.pendingSync',
  PROJECT_ID: 'panelTodo.projectId',
} as const;

// ============================================
// Configuration
// ============================================

export const CONFIG = {
  TODO_FILE_NAME: 'panel-todo.json',
  DEFAULT_API_BASE_URL: 'https://api.paneltodo.com',
  API_BASE_URL_SETTING: 'apiBaseUrl',
  // Stripe Payment Links (TEST MODE)
  STRIPE_PRO_PAYMENT_LINK: 'https://buy.stripe.com/test_00w14o05AfJWaoR18o5sA01',
  STRIPE_PRO_YEARLY_PAYMENT_LINK: 'https://buy.stripe.com/test_6oU00kg4ycxK7cF2cs5sA02',
  // Dev mode settings
  DEV_MODE: false, // Set to true for development
  DEV_API_URL: 'http://localhost:3000',
  DEV_FAKE_USER_ID: '00000000-0000-0000-0000-000000000001',
} as const;

// ============================================
// Todo Types (Free Tier)
// ============================================

export interface Todo {
  id: string;
  text: string;
  createdAt: number;
}

// ============================================
// User & Auth Types
// ============================================

export type UserTier = 'free' | 'pro' | 'team';

export interface User {
  id: string;
  email?: string;
  tier: UserTier;
  stripeCustomerId?: string;
  createdAt?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface DeviceCodeResponse {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

// ============================================
// Issue Types (Pro Tier)
// ============================================

export type IssueStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type IssuePriority = 'low' | 'medium' | 'high' | 'critical';

export interface Issue {
  id: string;
  key: string; // e.g., "PT-123"
  projectId: string;
  title: string;
  description?: string;
  status: IssueStatus;
  priority: IssuePriority;
  sprintId?: string | null;
  tags?: Tag[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateIssueInput {
  title: string;
  priority?: IssuePriority;
  status?: IssueStatus;
  sprintId?: string;
  description?: string;
}

export interface UpdateIssueInput {
  title?: string;
  description?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  sprintId?: string | null;
}

// ============================================
// Sprint Types (Pro Tier)
// ============================================

export type SprintStatus = 'planning' | 'active' | 'completed';

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  status: SprintStatus;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSprintInput {
  name: string;
  startDate?: string;
  endDate?: string;
}

export interface UpdateSprintInput {
  name?: string;
  startDate?: string;
  endDate?: string;
}

// ============================================
// Tag Types (Pro Tier)
// ============================================

export interface Tag {
  id: string;
  projectId: string;
  name: string;
  color: string; // Hex color, e.g., "#FF5733"
  createdAt: string;
}

export interface CreateTagInput {
  name: string;
  color: string;
}

export interface UpdateTagInput {
  name?: string;
  color?: string;
}

// ============================================
// Project Types (Pro Tier)
// ============================================

export interface Project {
  id: string;
  userId: string;
  name: string;
  key: string; // e.g., "PT", "WORK"
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  key: string;
  description?: string;
}

// ============================================
// Comment Types (Pro Tier)
// ============================================

export interface Comment {
  id: string;
  issueId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export interface IssuesResponse {
  issues: Issue[];
}

export interface SprintsResponse {
  sprints: Sprint[];
}

export interface TagsResponse {
  tags: Tag[];
}

export interface ProjectsResponse {
  projects: Project[];
}

export interface CommentsResponse {
  comments: Comment[];
}

// ============================================
// WebSocket Event Types
// ============================================

export type WebSocketEventType =
  | 'connected'
  | 'issue:created'
  | 'issue:updated'
  | 'issue:deleted'
  | 'sprint:created'
  | 'sprint:updated'
  | 'sprint:deleted'
  | 'sprint:completed'
  | 'project:created'
  | 'project:updated'
  | 'project:deleted'
  | 'tag:created'
  | 'tag:updated'
  | 'tag:deleted';

export interface WebSocketEvent {
  type: WebSocketEventType;
  data?: Record<string, unknown>;
}

// ============================================
// Webview Message Types
// ============================================

export type WebviewMessageType =
  // Todo messages
  | 'add'
  | 'delete'
  | 'deleteAll'
  | 'ready'
  // Issue messages
  | 'createIssue'
  | 'updateIssue'
  | 'deleteIssue'
  | 'fetchComments'
  | 'addComment'
  // Sprint messages
  | 'createSprint'
  | 'updateSprint'
  | 'deleteSprint'
  | 'completeSprint'
  | 'startSprint'
  | 'reactivateSprint'
  | 'fetchBacklogIssues'
  // Tag messages
  | 'createTag'
  | 'updateTag'
  | 'deleteTag'
  | 'addTagToIssue'
  | 'removeTagFromIssue'
  // Project messages
  | 'createProject'
  | 'switchProject'
  // Auth messages
  | 'signIn'
  | 'signOut'
  | 'openUpgrade'
  | 'openUpgradeYearly'
  // Dev mode messages
  | 'devSetTier'
  | 'devToggleAuth'
  // Misc
  | 'exportAsPrompt'
  | 'copyToClipboard';

export interface WebviewMessage {
  type: WebviewMessageType;
  text?: string;
  id?: string;
  issueId?: string;
  sprintId?: string;
  tagId?: string;
  projectId?: string;
  updates?: Record<string, unknown>;
  title?: string;
  name?: string;
  key?: string;
  priority?: IssuePriority;
  status?: IssueStatus;
  color?: string;
  content?: string;
  tier?: UserTier;
  moveToBacklog?: boolean;
  moveIncomplete?: boolean;
}

// ============================================
// Extension Message Types (Host -> Webview)
// ============================================

export type ExtensionMessageType =
  | 'todos'
  | 'issues'
  | 'sprints'
  | 'tags'
  | 'projects'
  | 'currentProject'
  | 'backlogIssues'
  | 'comments'
  | 'authState'
  | 'userInfo'
  | 'error';

export interface ExtensionMessage {
  type: ExtensionMessageType;
  todos?: Todo[];
  issues?: Issue[];
  sprints?: Sprint[];
  tags?: Tag[];
  projects?: Project[];
  currentProject?: Project | null;
  backlogIssues?: Issue[];
  comments?: Comment[];
  isAuthenticated?: boolean;
  isPro?: boolean;
  user?: User | null;
  devMode?: boolean;
  devFakeTier?: UserTier | null;
  error?: string;
}

// ============================================
// HTTP Request Types
// ============================================

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

// ============================================
// Service Interfaces
// ============================================

export interface IStorageService {
  getTodos(): Todo[];
  setTodos(todos: Todo[]): Promise<void>;
  getAccessToken(): string | undefined;
  setAccessToken(token: string): Promise<void>;
  getRefreshToken(): string | undefined;
  setRefreshToken(token: string): Promise<void>;
  clearAuthTokens(): Promise<void>;
  getProjectId(): string | undefined;
  setProjectId(projectId: string | null): Promise<void>;
}

export interface IApiService {
  request<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>>;
  getEffectiveApiUrl(): string;
  getApiHeaders(): Record<string, string>;
}

export interface IAuthService {
  signIn(): Promise<boolean>;
  signOut(): Promise<void>;
  refreshAccessToken(): Promise<boolean>;
  fetchUserInfo(): Promise<User | null>;
  isAuthenticated(): boolean;
  isPro(): boolean;
}

export interface IWebSocketService {
  connect(): void;
  disconnect(): void;
  isConnected(): boolean;
  onEvent(handler: (event: WebSocketEvent) => void): void;
}
