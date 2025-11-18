import { API } from "./constants/api";
import { STORAGE_KEYS } from "./constants/storage";
import { CSS_CLASSES, ELEMENT_IDS, STATUS_ICONS, UI_TIMING } from "./constants/ui";
import { DisplayMode, StatusType } from "./shared/types";

(() => {
  type CallbackResponse = {
    access_token: string;
    refresh_token: string;
  };

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
      displayModeSelect: getElement<HTMLSelectElement>(ELEMENT_IDS.DISPLAY_MODE),
      loggedInSection: getElement<HTMLElement>(ELEMENT_IDS.LOGGED_IN_SECTION),
      loginBtn: getElement<HTMLButtonElement>(ELEMENT_IDS.LOGIN_BTN),
      loginSection: getElement<HTMLElement>(ELEMENT_IDS.LOGIN_SECTION),
      logoutBtn: getElement<HTMLButtonElement>(ELEMENT_IDS.LOGOUT_BTN),
      statusClose: getElement<HTMLButtonElement>(ELEMENT_IDS.STATUS_CLOSE),
      statusDiv: getElement<HTMLDivElement>(ELEMENT_IDS.STATUS),
      statusIconPath: getElement<SVGPathElement>(ELEMENT_IDS.STATUS_ICON_PATH),
      statusMessage: getElement<HTMLSpanElement>(ELEMENT_IDS.STATUS_MESSAGE),
    };
  };

  const setButtonLoading = (button: HTMLButtonElement, loading: boolean) => {
    button.disabled = loading;
    if (loading) {
      button.classList.add(CSS_CLASSES.POPUP.LOADING);
      button.setAttribute("aria-busy", "true");
    } else {
      button.classList.remove(CSS_CLASSES.POPUP.LOADING);
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
    statusIconPath.setAttribute("d", STATUS_ICONS[type]);
    statusDiv.className = `popup__status popup__status--${type} ${CSS_CLASSES.POPUP.VISIBLE}`;

    statusHideTimer = setTimeout(() => {
      hideStatus(elements);
    }, UI_TIMING.STATUS_DISPLAY_DURATION);
  };

  const hideStatus = (elements: UIElements) => {
    const { statusDiv } = elements;
    statusDiv.classList.remove(CSS_CLASSES.POPUP.VISIBLE);

    if (statusHideTimer) {
      clearTimeout(statusHideTimer);
      statusHideTimer = null;
    }
  };

  const checkAuthStatus = async (): Promise<boolean> => {
    const result = await chrome.storage.session.get([
      STORAGE_KEYS.ACCESS_TOKEN,
      STORAGE_KEYS.REFRESH_TOKEN,
    ]);
    return !!(result[STORAGE_KEYS.ACCESS_TOKEN] && result[STORAGE_KEYS.REFRESH_TOKEN]);
  };

  const addSuccessPulse = (element: HTMLElement) => {
    element.classList.add(CSS_CLASSES.POPUP.SUCCESS_PULSE);
    setTimeout(() => {
      element.classList.remove(CSS_CLASSES.POPUP.SUCCESS_PULSE);
    }, UI_TIMING.SUCCESS_PULSE_DURATION);
  };

  const updateUI = async (elements: UIElements, showPulse = false) => {
    const { loggedInSection, loginSection } = elements;
    const isLoggedIn = await checkAuthStatus();

    if (isLoggedIn) {
      loginSection.classList.remove(CSS_CLASSES.POPUP.ACTIVE);
      loggedInSection.classList.add(CSS_CLASSES.POPUP.ACTIVE);

      if (showPulse) {
        const userInfo = loggedInSection.querySelector(".popup__user-info");
        if (userInfo instanceof HTMLElement) {
          addSuccessPulse(userInfo);
        }
      }
    } else {
      loginSection.classList.add(CSS_CLASSES.POPUP.ACTIVE);
      loggedInSection.classList.remove(CSS_CLASSES.POPUP.ACTIVE);
    }
  };

  const handleLogin = async (elements: UIElements) => {
    const { loginBtn } = elements;

    setButtonLoading(loginBtn, true);

    try {
      const state = generateState();
      const redirectUri = chrome.identity.getRedirectURL();

      await chrome.storage.session.set({ [STORAGE_KEYS.OAUTH_STATE]: state });

      const authUrl = `${API.GITHUB.OAUTH_URL}?client_id=${API.GITHUB.CLIENT_ID}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&scope=${API.GITHUB.SCOPE}&state=${state}`;

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

      const { [STORAGE_KEYS.OAUTH_STATE]: storedState } = await chrome.storage.session.get([
        STORAGE_KEYS.OAUTH_STATE,
      ]);

      if (returnedState !== storedState) {
        showStatus(elements, "Security validation failed", "error");
        return;
      }

      await chrome.storage.session.remove([STORAGE_KEYS.OAUTH_STATE]);

      const callbackUrl = `${API.BASE_URL}/callback?code=${code}&state=${returnedState}`;
      const response = await fetch(callbackUrl);

      if (!response.ok) {
        throw new Error(`Authentication failed (${response.status}). Please try again.`);
      }

      const data: CallbackResponse = await response.json();

      await chrome.storage.session.set({
        [STORAGE_KEYS.ACCESS_TOKEN]: data.access_token,
        [STORAGE_KEYS.REFRESH_TOKEN]: data.refresh_token,
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
      await chrome.storage.session.remove([STORAGE_KEYS.ACCESS_TOKEN, STORAGE_KEYS.REFRESH_TOKEN]);
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
    const result = await chrome.storage.sync.get([STORAGE_KEYS.DISPLAY_MODE]);
    const value = result[STORAGE_KEYS.DISPLAY_MODE];
    const mode = value === "compact" ? "compact" : "full";
    displayModeSelect.value = mode;
  };

  const handleDisplayModeChange = async (elements: UIElements, mode: DisplayMode) => {
    await chrome.storage.sync.set({ [STORAGE_KEYS.DISPLAY_MODE]: mode });

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
