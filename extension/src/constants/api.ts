export const API = {
  BASE_URL: "https://github-project-status-viewer.vercel.app/api",
  GITHUB: {
    CLIENT_ID: "Ov23liFFkeCk13ofhM7c",
    OAUTH_URL: "https://github.com/login/oauth/authorize",
    SCOPE: "repo project",
  },
} as const;

export const ERROR_MESSAGES = {
  AUTH_REQUIRED: "Authentication required. Please log in via the extension popup.",
} as const;
