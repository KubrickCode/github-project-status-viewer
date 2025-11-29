import { API } from "../constants/api";
import { STORAGE_KEYS } from "../constants/storage";
import {
  clearTokens,
  exchangeCodeForTokens,
  generateState,
  getStoredTokens,
  initiateOAuth,
  isAuthenticated,
  storeTokens,
} from "./auth.service";

const mockChromeIdentity = {
  getRedirectURL: jest.fn(),
  launchWebAuthFlow: jest.fn(),
};

const mockChromeStorage = {
  session: {
    get: jest.fn(),
    remove: jest.fn(),
    set: jest.fn(),
  },
};

const EXPECTED_DETERMINISTIC_STATE =
  "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";

const mockGetRandomValues = jest.fn((array: Uint8Array) => {
  for (let i = 0; i < array.length; i++) {
    array[i] = i;
  }
  return array;
});

Object.defineProperty(globalThis, "chrome", {
  value: {
    identity: mockChromeIdentity,
    storage: mockChromeStorage,
  },
  writable: true,
});

Object.defineProperty(globalThis, "crypto", {
  value: {
    getRandomValues: mockGetRandomValues,
  },
  writable: true,
});

globalThis.fetch = jest.fn() as jest.Mock;

describe("auth.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRandomValues.mockImplementation((array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = i;
      }
      return array;
    });
  });

  describe("generateState", () => {
    it("should generate state string from crypto random values", () => {
      const state = generateState();

      expect(state).toHaveLength(64);
      expect(mockGetRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
    });

    it("should generate deterministic state with mocked crypto", () => {
      const state1 = generateState();
      const state2 = generateState();

      expect(state1).toBe(state2);
      expect(state1).toBe(EXPECTED_DETERMINISTIC_STATE);
    });
  });

  describe("storeTokens", () => {
    it("should store access and refresh tokens in session storage", async () => {
      await storeTokens({ accessToken: "access_token_123", refreshToken: "refresh_token_456" });

      expect(mockChromeStorage.session.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.ACCESS_TOKEN]: "access_token_123",
        [STORAGE_KEYS.REFRESH_TOKEN]: "refresh_token_456",
      });
    });
  });

  describe("getStoredTokens", () => {
    it("should retrieve access and refresh tokens from session storage", async () => {
      mockChromeStorage.session.get.mockResolvedValueOnce({
        [STORAGE_KEYS.ACCESS_TOKEN]: "stored_access_token",
        [STORAGE_KEYS.REFRESH_TOKEN]: "stored_refresh_token",
      });

      const result = await getStoredTokens();

      expect(result).toEqual({
        accessToken: "stored_access_token",
        refreshToken: "stored_refresh_token",
      });
      expect(mockChromeStorage.session.get).toHaveBeenCalledWith({
        [STORAGE_KEYS.ACCESS_TOKEN]: null,
        [STORAGE_KEYS.REFRESH_TOKEN]: null,
      });
    });

    it("should return null values when tokens are not stored", async () => {
      mockChromeStorage.session.get.mockResolvedValueOnce({});

      const result = await getStoredTokens();

      expect(result).toEqual({
        accessToken: null,
        refreshToken: null,
      });
    });

    it("should handle partial token storage", async () => {
      mockChromeStorage.session.get.mockResolvedValueOnce({
        [STORAGE_KEYS.ACCESS_TOKEN]: "access_token_only",
      });

      const result = await getStoredTokens();

      expect(result).toEqual({
        accessToken: "access_token_only",
        refreshToken: null,
      });
    });
  });

  describe("clearTokens", () => {
    it("should remove access and refresh tokens from session storage", async () => {
      await clearTokens();

      expect(mockChromeStorage.session.remove).toHaveBeenCalledWith([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
      ]);
    });
  });

  describe("isAuthenticated", () => {
    it("should return true when both tokens exist", async () => {
      mockChromeStorage.session.get.mockResolvedValueOnce({
        [STORAGE_KEYS.ACCESS_TOKEN]: "access_token",
        [STORAGE_KEYS.REFRESH_TOKEN]: "refresh_token",
      });

      const result = await isAuthenticated();

      expect(result).toBe(true);
    });

    it("should return false when access token is missing", async () => {
      mockChromeStorage.session.get.mockResolvedValueOnce({
        [STORAGE_KEYS.REFRESH_TOKEN]: "refresh_token",
      });

      const result = await isAuthenticated();

      expect(result).toBe(false);
    });

    it("should return false when refresh token is missing", async () => {
      mockChromeStorage.session.get.mockResolvedValueOnce({
        [STORAGE_KEYS.ACCESS_TOKEN]: "access_token",
      });

      const result = await isAuthenticated();

      expect(result).toBe(false);
    });

    it("should return false when both tokens are missing", async () => {
      mockChromeStorage.session.get.mockResolvedValueOnce({});

      const result = await isAuthenticated();

      expect(result).toBe(false);
    });
  });

  describe("initiateOAuth", () => {
    const mockRedirectUri = "https://extension-redirect.chromium.org";
    const mockState = "test_state_12345";

    beforeEach(() => {
      mockChromeIdentity.getRedirectURL.mockReturnValue(mockRedirectUri);
    });

    it("should successfully complete OAuth flow", async () => {
      const mockCode = "oauth_code_123";
      const mockRedirectUrl = `${mockRedirectUri}?code=${mockCode}&state=${mockState}`;

      mockChromeStorage.session.get.mockResolvedValueOnce({
        [STORAGE_KEYS.OAUTH_STATE]: mockState,
      });
      mockChromeIdentity.launchWebAuthFlow.mockResolvedValueOnce(mockRedirectUrl);

      const result = await initiateOAuth(mockState);

      expect(result).toEqual({
        code: mockCode,
        state: mockState,
      });

      expect(mockChromeStorage.session.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.OAUTH_STATE]: mockState,
      });

      expect(mockChromeIdentity.launchWebAuthFlow).toHaveBeenCalledWith({
        interactive: true,
        url: `${API.GITHUB.OAUTH_URL}?client_id=${API.GITHUB.CLIENT_ID}&redirect_uri=${encodeURIComponent(
          mockRedirectUri
        )}&scope=${API.GITHUB.SCOPE}&state=${mockState}`,
      });

      expect(mockChromeStorage.session.remove).toHaveBeenCalledWith([STORAGE_KEYS.OAUTH_STATE]);
    });

    it("should throw error when OAuth flow is cancelled", async () => {
      mockChromeIdentity.launchWebAuthFlow.mockResolvedValueOnce(undefined);

      await expect(initiateOAuth(mockState)).rejects.toThrow("OAuth flow cancelled by user");

      expect(mockChromeStorage.session.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.OAUTH_STATE]: mockState,
      });
    });

    it("should throw error when code is missing from redirect URL", async () => {
      const mockRedirectUrl = `${mockRedirectUri}?state=${mockState}`;

      mockChromeIdentity.launchWebAuthFlow.mockResolvedValueOnce(mockRedirectUrl);

      await expect(initiateOAuth(mockState)).rejects.toThrow(
        "Invalid OAuth response: missing code or state"
      );
    });

    it("should throw error when state is missing from redirect URL", async () => {
      const mockRedirectUrl = `${mockRedirectUri}?code=oauth_code`;

      mockChromeIdentity.launchWebAuthFlow.mockResolvedValueOnce(mockRedirectUrl);

      await expect(initiateOAuth(mockState)).rejects.toThrow(
        "Invalid OAuth response: missing code or state"
      );
    });

    it("should throw error when state validation fails", async () => {
      const mockCode = "oauth_code_123";
      const differentState = "different_state";
      const mockRedirectUrl = `${mockRedirectUri}?code=${mockCode}&state=${differentState}`;

      mockChromeStorage.session.get.mockResolvedValueOnce({
        [STORAGE_KEYS.OAUTH_STATE]: mockState,
      });
      mockChromeIdentity.launchWebAuthFlow.mockResolvedValueOnce(mockRedirectUrl);

      await expect(initiateOAuth(mockState)).rejects.toThrow(
        "State validation failed: potential CSRF attack"
      );
    });

    it("should clean up OAuth state after successful flow", async () => {
      const mockCode = "oauth_code_123";
      const mockRedirectUrl = `${mockRedirectUri}?code=${mockCode}&state=${mockState}`;

      mockChromeStorage.session.get.mockResolvedValueOnce({
        [STORAGE_KEYS.OAUTH_STATE]: mockState,
      });
      mockChromeIdentity.launchWebAuthFlow.mockResolvedValueOnce(mockRedirectUrl);

      await initiateOAuth(mockState);

      expect(mockChromeStorage.session.remove).toHaveBeenCalledWith([STORAGE_KEYS.OAUTH_STATE]);
    });
  });

  describe("exchangeCodeForTokens", () => {
    it("should exchange code for tokens successfully", async () => {
      const mockResponse = {
        access_token: "github_access_token",
        refresh_token: "github_refresh_token",
      };

      (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => mockResponse,
        ok: true,
      });

      const result = await exchangeCodeForTokens({ code: "oauth_code_123", state: "state_456" });

      expect(result).toEqual(mockResponse);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${API.BASE_URL}/callback?code=oauth_code_123&state=state_456`
      );
    });

    it("should throw error when callback fails with 400", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      await expect(exchangeCodeForTokens({ code: "invalid_code", state: "state" })).rejects.toThrow(
        "Authentication failed (400). Please try again."
      );
    });

    it("should throw error when callback fails with 401", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await expect(exchangeCodeForTokens({ code: "expired_code", state: "state" })).rejects.toThrow(
        "Authentication failed (401). Please try again."
      );
    });

    it("should throw error when callback fails with 500", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(exchangeCodeForTokens({ code: "code", state: "state" })).rejects.toThrow(
        "Authentication failed (500). Please try again."
      );
    });
  });
});
