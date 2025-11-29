export const CSS_CLASSES = {
  BADGE: "project-status-badge",
  BADGE_COMPACT: "project-status-badge--compact",
  POPUP: {
    ACTIVE: "popup__section--active",
    LOADING: "popup__btn--loading",
    SUCCESS_PULSE: "popup__user-info--success",
    VISIBLE: "popup__status--visible",
  },
} as const;

export const ELEMENT_IDS = {
  DISPLAY_MODE: "displayMode",
  LOGGED_IN_SECTION: "loggedInSection",
  LOGIN_BTN: "loginBtn",
  LOGIN_SECTION: "loginSection",
  LOGOUT_BTN: "logoutBtn",
  STATUS: "status",
  STATUS_CLOSE: "statusClose",
  STATUS_ICON_PATH: "statusIconPath",
  STATUS_MESSAGE: "statusMessage",
} as const;

export const SELECTORS = {
  ISSUE_LINK: '[data-testid="issue-pr-title-link"]',
  ISSUE_TITLE_CONTAINER: "h3",
} as const;

export const STATUS_ICONS = {
  error:
    "M2.343 13.657A8 8 0 1 1 13.658 2.343 8 8 0 0 1 2.343 13.657ZM6.03 4.97a.751.751 0 0 0-1.042.018.751.751 0 0 0-.018 1.042L6.94 8 4.97 9.97a.749.749 0 0 0 .326 1.275.749.749 0 0 0 .734-.215L8 9.06l1.97 1.97a.749.749 0 0 0 1.275-.326.749.749 0 0 0-.215-.734L9.06 8l1.97-1.97a.749.749 0 0 0-.326-1.275.749.749 0 0 0-.734.215L8 6.94Z",
  info: "M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z",
  success:
    "M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm9.78-2.22-5.5 5.5a.75.75 0 0 1-1.06 0l-2.5-2.5a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L5.75 9.19l4.97-4.97a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z",
} as const;

export const UI_DEFAULTS = {
  BADGE_COLOR: "#6e7781",
  DISPLAY_MODE: "full" as const,
} as const;

export const UI_MESSAGES = {
  AUTH: {
    LOGIN_ERROR_FALLBACK: "Login failed. Please try again.",
    LOGIN_IN_PROGRESS: "Opening GitHub login...",
    LOGIN_SUCCESS: "Successfully connected to GitHub!",
    LOGOUT_ERROR: "Sign out failed. Please try again.",
    LOGOUT_SUCCESS: "Signed out successfully",
  },
} as const;

export const UI_TIMING = {
  DEBOUNCE_DELAY: 500,
  POLL_INTERVAL: 200,
  POLL_TIMEOUT: 5000,
  STATUS_DISPLAY_DURATION: 3000,
  SUCCESS_PULSE_DURATION: 500,
} as const;

export const URL_PATTERNS = {
  GITHUB_ISSUES: /https:\/\/github\.com\/[^/]+\/[^/]+\/issues/,
  ISSUE_NUMBER: /\/issues\/(\d+)/,
  REPO_PATH: /^\/([^/]+)\/([^/]+)\/issues/,
} as const;
