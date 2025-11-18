import { STORAGE_KEYS } from "./constants/storage";
import { CSS_CLASSES, SELECTORS, UI_DEFAULTS, UI_TIMING, URL_PATTERNS } from "./constants/ui";
import { getIssueNumbers } from "./issue-parser";
import { DisplayMode, MessageRequest, MessageResponse } from "./shared/types";

(() => {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let isProcessing = false;
  let observer: MutationObserver | null = null;
  let pollIntervalId: ReturnType<typeof setInterval> | null = null;
  let pollTimeoutId: ReturnType<typeof setTimeout> | null = null;

  const calculateMaxBadgeWidth = (): number => {
    const badges = document.querySelectorAll(`.${CSS_CLASSES.BADGE}`);
    if (badges.length === 0) return 0;

    let maxWidth = 0;
    badges.forEach((badge) => {
      const width = (badge as HTMLElement).getBoundingClientRect().width;
      if (width > maxWidth) {
        maxWidth = width;
      }
    });

    return maxWidth;
  };

  const updateBadgeWidths = async () => {
    const displayMode = await getDisplayMode();
    if (displayMode === "compact") return;

    const maxWidth = calculateMaxBadgeWidth();
    if (maxWidth === 0) return;

    const badges = document.querySelectorAll(
      `.${CSS_CLASSES.BADGE}:not(.${CSS_CLASSES.BADGE_COMPACT})`
    );
    badges.forEach((badge) => {
      (badge as HTMLElement).style.minWidth = `${maxWidth}px`;
    });
  };

  const updateBadgeDisplay = async (
    badge: HTMLElement,
    displayMode: DisplayMode,
    status: string
  ) => {
    if (displayMode === "compact") {
      badge.classList.add(CSS_CLASSES.BADGE_COMPACT);
      badge.textContent = "";
      badge.title = status;
      badge.setAttribute("role", "img");
      badge.setAttribute("aria-label", `Status: ${status}`);
      badge.tabIndex = 0;
      badge.style.minWidth = "";
    } else {
      badge.classList.remove(CSS_CLASSES.BADGE_COMPACT);
      badge.textContent = status;
      badge.title = "";
      badge.removeAttribute("role");
      badge.removeAttribute("aria-label");
      badge.tabIndex = -1;
    }
  };

  const refreshAllBadges = async () => {
    const displayMode = await getDisplayMode();
    const badges = document.querySelectorAll(`.${CSS_CLASSES.BADGE}`);

    for (const badge of Array.from(badges)) {
      const statusText = badge.getAttribute("data-status");
      if (statusText) {
        await updateBadgeDisplay(badge as HTMLElement, displayMode, statusText);
      }
    }

    if (displayMode === "full") {
      requestAnimationFrame(() => {
        updateBadgeWidths();
      });
    }
  };

  const getDisplayMode = async (): Promise<DisplayMode> => {
    const result = await chrome.storage.sync.get([STORAGE_KEYS.DISPLAY_MODE]);
    const value = result[STORAGE_KEYS.DISPLAY_MODE];
    return value === "compact" ? "compact" : "full";
  };

  const addStatusBadge = async (issueNumber: number, status: string, color: string | null) => {
    const displayMode = await getDisplayMode();
    const issueLinks = document.querySelectorAll(SELECTORS.ISSUE_LINK);

    for (const link of Array.from(issueLinks)) {
      const href = link.getAttribute("href");
      if (!href?.includes(`/issues/${issueNumber}`)) continue;

      const h3Element = link.closest("h3");
      if (!h3Element) continue;

      const container = h3Element.parentElement;
      if (!container) continue;

      if (container.querySelector(`.${CSS_CLASSES.BADGE}`)) return;

      const badge = document.createElement("span");
      badge.className = CSS_CLASSES.BADGE;
      badge.setAttribute("data-status", status);
      badge.style.setProperty("--status-color", color || UI_DEFAULTS.BADGE_COLOR);

      await updateBadgeDisplay(badge, displayMode, status);

      container.insertBefore(badge, h3Element);
      return;
    }
  };

  const parseRepoInfo = () => {
    const match = window.location.pathname.match(URL_PATTERNS.REPO_PATH);
    if (!match) return null;

    return {
      owner: match[1],
      repo: match[2],
    };
  };

  const updateIssueStatuses = async () => {
    const repoInfo = parseRepoInfo();
    if (!repoInfo) return;

    const issueNumbers = getIssueNumbers();
    if (issueNumbers.length === 0) return;

    if (isProcessing) return;

    isProcessing = true;

    try {
      const request: MessageRequest = {
        issueNumbers,
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        type: "GET_PROJECT_STATUS",
      };

      const response: MessageResponse = await chrome.runtime.sendMessage(request);

      if (response.error) return;

      const statuses = response.statuses || [];

      for (const { color, number, status } of statuses) {
        if (status) {
          await addStatusBadge(number, status, color);
        }
      }

      await updateBadgeWidths();
    } catch {
      // Silent fail
    } finally {
      isProcessing = false;
    }
  };

  const startObserving = () => {
    if (observer) return;

    observer = new MutationObserver(() => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        updateIssueStatuses();
      }, UI_TIMING.DEBOUNCE_DELAY);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  };

  const run = () => {
    updateIssueStatuses();
    startObserving();
  };

  const init = () => {
    if (!window.location.href.match(URL_PATTERNS.GITHUB_ISSUES)) return;

    run();
  };

  const cleanupPollingTimers = () => {
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
    if (pollTimeoutId) {
      clearTimeout(pollTimeoutId);
      pollTimeoutId = null;
    }
  };

  const cleanupObserver = () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };

  const handleSPARouting = () => {
    cleanupObserver();
    cleanupPollingTimers();

    if (!window.location.href.match(URL_PATTERNS.GITHUB_ISSUES)) return;

    pollIntervalId = setInterval(() => {
      if (document.querySelector(SELECTORS.ISSUE_LINK)) {
        cleanupPollingTimers();
        run();
      }
    }, UI_TIMING.POLL_INTERVAL);

    pollTimeoutId = setTimeout(cleanupPollingTimers, UI_TIMING.POLL_TIMEOUT);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "RELOAD_BADGES") {
      const badges = document.querySelectorAll(`.${CSS_CLASSES.BADGE}`);
      if (badges.length > 0) {
        refreshAllBadges();
      } else {
        updateIssueStatuses();
      }
    }
  });

  document.addEventListener("turbo:load", handleSPARouting);
  document.addEventListener("pjax:end", handleSPARouting);
})();
