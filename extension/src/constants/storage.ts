export const STORAGE_KEYS = {
  ACCESS_TOKEN: "accessToken",
  DISPLAY_MODE: "displayMode",
  OAUTH_STATE: "oauthState",
  REFRESH_TOKEN: "refreshToken",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
