export const API = {
  BASE_URL: "https://github-project-status-viewer.vercel.app/api",
  GITHUB: {
    CLIENT_ID: "Ov23liFFkeCk13ofhM7c",
    GRAPHQL_URL: "https://api.github.com/graphql",
    OAUTH_URL: "https://github.com/login/oauth/authorize",
    SCOPE: "repo read:project",
  },
} as const;

export const ERROR_MESSAGES = {
  AUTH_REQUIRED: "Authentication required. Please log in via the extension popup.",
} as const;

export const GRAPHQL = {
  ISSUE_ALIAS_PREFIX: "issue",
  STATUS_FIELD_NAME: "Status",
} as const;
