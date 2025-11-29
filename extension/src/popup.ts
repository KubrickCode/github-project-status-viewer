import { STORAGE_KEYS } from "./constants/storage";
import { CSS_CLASSES, ELEMENT_IDS, STATUS_ICONS, UI_MESSAGES, UI_TIMING } from "./constants/ui";
import {
  clearTokens,
  exchangeCodeForTokens,
  generateState,
  initiateOAuth,
  isAuthenticated,
  storeTokens,
} from "./services/auth.service";
import { DisplayMode, StatusType } from "./shared/types";

(() => {
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

  const addSuccessPulse = (element: HTMLElement) => {
    element.classList.add(CSS_CLASSES.POPUP.SUCCESS_PULSE);
    setTimeout(() => {
      element.classList.remove(CSS_CLASSES.POPUP.SUCCESS_PULSE);
    }, UI_TIMING.SUCCESS_PULSE_DURATION);
  };

  const updateUI = async (elements: UIElements, showPulse = false) => {
    const { loggedInSection, loginSection } = elements;
    const authenticated = await isAuthenticated();

    if (authenticated) {
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
      showStatus(elements, UI_MESSAGES.AUTH.LOGIN_IN_PROGRESS, "info");

      const state = generateState();
      const { code, state: returnedState } = await initiateOAuth(state);
      const tokens = await exchangeCodeForTokens({ code, state: returnedState });

      await storeTokens({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });

      showStatus(elements, UI_MESSAGES.AUTH.LOGIN_SUCCESS, "success");
      await updateUI(elements, true);

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: "RELOAD_BADGES" });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : UI_MESSAGES.AUTH.LOGIN_ERROR_FALLBACK;
      showStatus(elements, message, "error");
    } finally {
      setButtonLoading(loginBtn, false);
    }
  };

  const handleLogout = async (elements: UIElements) => {
    const { logoutBtn } = elements;

    setButtonLoading(logoutBtn, true);

    try {
      await clearTokens();
      showStatus(elements, UI_MESSAGES.AUTH.LOGOUT_SUCCESS, "success");
      await updateUI(elements);
    } catch {
      showStatus(elements, UI_MESSAGES.AUTH.LOGOUT_ERROR, "error");
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

  const handleDisplayModeChange = async (_elements: UIElements, mode: DisplayMode) => {
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
