import { API } from "../constants/api";
import { STORAGE_KEYS } from "../constants/storage";

const ERROR_MESSAGES = {
  AUTH_FAILED: (status: number) => `Authentication failed (${status}). Please try again.`,
  OAUTH_CANCELLED: "OAuth flow cancelled by user",
  OAUTH_INVALID_RESPONSE: "Invalid OAuth response: missing code or state",
  STATE_VALIDATION_FAILED: "State validation failed: potential CSRF attack",
} as const;

const STATE_LENGTH = 32;

type OAuthTokenResponse = {
  access_token: string;
  refresh_token: string;
};

type OAuthFlowResult = {
  code: string;
  state: string;
};

export const clearTokens = async (): Promise<void> => {
  await chrome.storage.session.remove([STORAGE_KEYS.ACCESS_TOKEN, STORAGE_KEYS.REFRESH_TOKEN]);
};

export const exchangeCodeForTokens = async ({
  code,
  state,
}: {
  code: string;
  state: string;
}): Promise<OAuthTokenResponse> => {
  const callbackUrl = `${API.BASE_URL}/callback?code=${code}&state=${state}`;
  const response = await fetch(callbackUrl);

  if (!response.ok) {
    throw new Error(ERROR_MESSAGES.AUTH_FAILED(response.status));
  }

  return await response.json();
};

export const generateState = (): string => {
  const array = new Uint8Array(STATE_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const getStoredTokens = async (): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> => {
  const result = await chrome.storage.session.get({
    [STORAGE_KEYS.ACCESS_TOKEN]: null,
    [STORAGE_KEYS.REFRESH_TOKEN]: null,
  });

  const accessToken = result[STORAGE_KEYS.ACCESS_TOKEN];
  const refreshToken = result[STORAGE_KEYS.REFRESH_TOKEN];

  return {
    accessToken: typeof accessToken === "string" ? accessToken : null,
    refreshToken: typeof refreshToken === "string" ? refreshToken : null,
  };
};

export const initiateOAuth = async (state: string): Promise<OAuthFlowResult> => {
  const redirectUri = chrome.identity.getRedirectURL();

  await chrome.storage.session.set({ [STORAGE_KEYS.OAUTH_STATE]: state });

  const authUrl = `${API.GITHUB.OAUTH_URL}?client_id=${API.GITHUB.CLIENT_ID}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${API.GITHUB.SCOPE}&state=${state}`;

  const redirectUrl = await chrome.identity.launchWebAuthFlow({
    interactive: true,
    url: authUrl,
  });

  if (!redirectUrl) {
    throw new Error(ERROR_MESSAGES.OAUTH_CANCELLED);
  }

  const url = new URL(redirectUrl);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");

  if (!code || !returnedState) {
    throw new Error(ERROR_MESSAGES.OAUTH_INVALID_RESPONSE);
  }

  const { [STORAGE_KEYS.OAUTH_STATE]: storedState } = await chrome.storage.session.get([
    STORAGE_KEYS.OAUTH_STATE,
  ]);

  if (returnedState !== storedState) {
    throw new Error(ERROR_MESSAGES.STATE_VALIDATION_FAILED);
  }

  await chrome.storage.session.remove([STORAGE_KEYS.OAUTH_STATE]);

  return {
    code,
    state: returnedState,
  };
};

export const isAuthenticated = async (): Promise<boolean> => {
  const { accessToken, refreshToken } = await getStoredTokens();
  return !!(accessToken && refreshToken);
};

export const storeTokens = async ({
  accessToken,
  refreshToken,
}: {
  accessToken: string;
  refreshToken: string;
}): Promise<void> => {
  await chrome.storage.session.set({
    [STORAGE_KEYS.ACCESS_TOKEN]: accessToken,
    [STORAGE_KEYS.REFRESH_TOKEN]: refreshToken,
  });
};
