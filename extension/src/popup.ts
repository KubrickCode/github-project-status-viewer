(() => {
  type CallbackResponse = {
    access_token: string;
    refresh_token: string;
  };

  type DisplayMode = "compact" | "full";

  type StatusType = "error" | "info" | "success";

  type UIElements = {
    displayModeSelect: HTMLSelectElement;
    loggedInSection: HTMLElement;
    loginBtn: HTMLButtonElement;
    loginSection: HTMLElement;
    logoutBtn: HTMLButtonElement;
    statusClose: HTMLButtonElement;
    statusDiv: HTMLDivElement;
    statusIconPath: SVGPathElement;
    statusMessage: HTMLSpanElement;
  };

  const ACCESS_TOKEN_KEY = "accessToken";
  const API_BASE_URL = "https://github-project-status-viewer.vercel.app/api";
  const CSS_CLASS = {
    ACTIVE: "popup__section--active",
    LOADING: "popup__btn--loading",
    SUCCESS_PULSE: "popup__user-info--success",
    VISIBLE: "popup__status--visible",
  } as const;
  const DISPLAY_MODE_KEY = "displayMode";
  const ELEMENT_ID = {
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
  const GITHUB_CLIENT_ID = "Ov23liFFkeCk13ofhM7c";
  const GITHUB_OAUTH_URL = "https://github.com/login/oauth/authorize";
  const OAUTH_SCOPE_STRING = "repo read:project";
  const OAUTH_STATE_KEY = "oauthState";
  const REFRESH_TOKEN_KEY = "refreshToken";
  const STATUS_DISPLAY_DURATION = 3000;
  const STATUS_ICON_PATH = {
    error:
      "M2.343 13.657A8 8 0 1 1 13.658 2.343 8 8 0 0 1 2.343 13.657ZM6.03 4.97a.751.751 0 0 0-1.042.018.751.751 0 0 0-.018 1.042L6.94 8 4.97 9.97a.749.749 0 0 0 .326 1.275.749.749 0 0 0 .734-.215L8 9.06l1.97 1.97a.749.749 0 0 0 1.275-.326.749.749 0 0 0-.215-.734L9.06 8l1.97-1.97a.749.749 0 0 0-.326-1.275.749.749 0 0 0-.734.215L8 6.94Z",
    info: "M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z",
    success:
      "M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm9.78-2.22-5.5 5.5a.75.75 0 0 1-1.06 0l-2.5-2.5a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L5.75 9.19l4.97-4.97a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z",
  } as const;

  let statusHideTimer: ReturnType<typeof setTimeout> | null = null;

  const generateState = (): string => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
  };

  const getUIElements = (): UIElements => {
    const getElement = <T>(id: string): T => {
      const element = document.getElementById(id);
      if (!element) {
        throw new Error(`Required element not found: ${id}`);
      }
      return element as unknown as T;
    };

    return {
      displayModeSelect: getElement<HTMLSelectElement>(ELEMENT_ID.DISPLAY_MODE),
      loggedInSection: getElement<HTMLElement>(ELEMENT_ID.LOGGED_IN_SECTION),
      loginBtn: getElement<HTMLButtonElement>(ELEMENT_ID.LOGIN_BTN),
      loginSection: getElement<HTMLElement>(ELEMENT_ID.LOGIN_SECTION),
      logoutBtn: getElement<HTMLButtonElement>(ELEMENT_ID.LOGOUT_BTN),
      statusClose: getElement<HTMLButtonElement>(ELEMENT_ID.STATUS_CLOSE),
      statusDiv: getElement<HTMLDivElement>(ELEMENT_ID.STATUS),
      statusIconPath: getElement<SVGPathElement>(ELEMENT_ID.STATUS_ICON_PATH),
      statusMessage: getElement<HTMLSpanElement>(ELEMENT_ID.STATUS_MESSAGE),
    };
  };

  const setButtonLoading = (button: HTMLButtonElement, loading: boolean) => {
    button.disabled = loading;
    if (loading) {
      button.classList.add(CSS_CLASS.LOADING);
      button.setAttribute("aria-busy", "true");
    } else {
      button.classList.remove(CSS_CLASS.LOADING);
      button.removeAttribute("aria-busy");
    }
  };

  const showStatus = (elements: UIElements, message: string, type: StatusType) => {
    const { statusDiv, statusIconPath, statusMessage } = elements;

    if (statusHideTimer) {
      clearTimeout(statusHideTimer);
      statusHideTimer = null;
    }

    statusMessage.textContent = message;
    statusIconPath.setAttribute("d", STATUS_ICON_PATH[type]);
    statusDiv.className = `popup__status popup__status--${type} ${CSS_CLASS.VISIBLE}`;

    statusHideTimer = setTimeout(() => {
      hideStatus(elements);
    }, STATUS_DISPLAY_DURATION);
  };

  const hideStatus = (elements: UIElements) => {
    const { statusDiv } = elements;
    statusDiv.classList.remove(CSS_CLASS.VISIBLE);

    if (statusHideTimer) {
      clearTimeout(statusHideTimer);
      statusHideTimer = null;
    }
  };

  const checkAuthStatus = async (): Promise<boolean> => {
    const result = await chrome.storage.session.get([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
    return !!(result[ACCESS_TOKEN_KEY] && result[REFRESH_TOKEN_KEY]);
  };

  const addSuccessPulse = (element: HTMLElement) => {
    element.classList.add(CSS_CLASS.SUCCESS_PULSE);
    setTimeout(() => {
      element.classList.remove(CSS_CLASS.SUCCESS_PULSE);
    }, 500);
  };

  const updateUI = async (elements: UIElements, showPulse = false) => {
    const { loggedInSection, loginSection } = elements;
    const isLoggedIn = await checkAuthStatus();

    if (isLoggedIn) {
      loginSection.classList.remove(CSS_CLASS.ACTIVE);
      loggedInSection.classList.add(CSS_CLASS.ACTIVE);

      if (showPulse) {
        const userInfo = loggedInSection.querySelector(".popup__user-info");
        if (userInfo instanceof HTMLElement) {
          addSuccessPulse(userInfo);
        }
      }
    } else {
      loginSection.classList.add(CSS_CLASS.ACTIVE);
      loggedInSection.classList.remove(CSS_CLASS.ACTIVE);
    }
  };

  const handleLogin = async (elements: UIElements) => {
    const { loginBtn } = elements;

    setButtonLoading(loginBtn, true);

    try {
      const state = generateState();
      const redirectUri = chrome.identity.getRedirectURL();

      await chrome.storage.session.set({ [OAUTH_STATE_KEY]: state });

      const authUrl = `${GITHUB_OAUTH_URL}?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&scope=${OAUTH_SCOPE_STRING}&state=${state}`;

      showStatus(elements, "Opening GitHub login...", "info");

      const redirectUrl = await chrome.identity.launchWebAuthFlow({
        interactive: true,
        url: authUrl,
      });

      if (!redirectUrl) {
        showStatus(elements, "Login cancelled", "error");
        return;
      }

      const url = new URL(redirectUrl);
      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");

      if (!code || !returnedState) {
        showStatus(elements, "Invalid OAuth response", "error");
        return;
      }

      const { [OAUTH_STATE_KEY]: storedState } = await chrome.storage.session.get([
        OAUTH_STATE_KEY,
      ]);

      if (returnedState !== storedState) {
        showStatus(elements, "Security validation failed", "error");
        return;
      }

      await chrome.storage.session.remove([OAUTH_STATE_KEY]);

      const callbackUrl = `${API_BASE_URL}/callback?code=${code}&state=${returnedState}`;
      const response = await fetch(callbackUrl);

      if (!response.ok) {
        throw new Error(`Authentication failed (${response.status}). Please try again.`);
      }

      const data: CallbackResponse = await response.json();

      await chrome.storage.session.set({
        [ACCESS_TOKEN_KEY]: data.access_token,
        [REFRESH_TOKEN_KEY]: data.refresh_token,
      });

      showStatus(elements, "Successfully connected to GitHub!", "success");
      await updateUI(elements, true);

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: "RELOAD_BADGES" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed. Please try again.";
      showStatus(elements, message, "error");
    } finally {
      setButtonLoading(loginBtn, false);
    }
  };

  const handleLogout = async (elements: UIElements) => {
    const { logoutBtn } = elements;

    setButtonLoading(logoutBtn, true);

    try {
      await chrome.storage.session.remove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
      showStatus(elements, "Signed out successfully", "success");
      await updateUI(elements);
    } catch {
      showStatus(elements, "Sign out failed. Please try again.", "error");
    } finally {
      setButtonLoading(logoutBtn, false);
    }
  };

  const loadDisplayMode = async (elements: UIElements) => {
    const { displayModeSelect } = elements;
    const result = await chrome.storage.sync.get([DISPLAY_MODE_KEY]);
    const value = result[DISPLAY_MODE_KEY];
    const mode = value === "compact" ? "compact" : "full";
    displayModeSelect.value = mode;
  };

  const handleDisplayModeChange = async (elements: UIElements, mode: DisplayMode) => {
    await chrome.storage.sync.set({ [DISPLAY_MODE_KEY]: mode });

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: "RELOAD_BADGES" });
    }
  };

  const init = async () => {
    try {
      const elements = getUIElements();

      await updateUI(elements);
      await loadDisplayMode(elements);

      elements.loginBtn.addEventListener("click", () => handleLogin(elements));
      elements.logoutBtn.addEventListener("click", () => handleLogout(elements));
      elements.statusClose.addEventListener("click", () => hideStatus(elements));
      elements.displayModeSelect.addEventListener("change", (e) => {
        if (!(e.target instanceof HTMLSelectElement)) return;
        const value = e.target.value;
        const mode: DisplayMode = value === "compact" ? "compact" : "full";
        handleDisplayModeChange(elements, mode);
      });
    } catch (error) {
      console.error("Failed to initialize popup:", error);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
