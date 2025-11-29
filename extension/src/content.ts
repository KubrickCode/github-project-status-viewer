import { STORAGE_KEYS } from "./constants/storage";
import { CSS_CLASSES, SELECTORS, UI_TIMING, URL_PATTERNS } from "./constants/ui";
import {
  applyUniformWidth,
  calculateMaxBadgeWidth,
  insertBadge,
  refreshAllBadgeDisplays,
} from "./services/badge-renderer.service";
import { extractIssueNumbers, parseRepositoryInfo } from "./services/dom-parser.service";
import { DisplayMode, MessageRequest, MessageResponse } from "./shared/types";

(() => {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let isProcessing = false;
  let observer: MutationObserver | null = null;
  let pollIntervalId: ReturnType<typeof setInterval> | null = null;
  let pollTimeoutId: ReturnType<typeof setTimeout> | null = null;

  const updateBadgeWidths = async () => {
    const displayMode = await getDisplayMode();
    if (displayMode === "compact") return;

    const maxWidth = calculateMaxBadgeWidth();
    applyUniformWidth({ maxWidth });
  };

  const refreshAllBadges = async () => {
    const displayMode = await getDisplayMode();
    refreshAllBadgeDisplays(displayMode);

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
    insertBadge({ color, displayMode, issueNumber, status });
  };

  const updateIssueStatuses = async () => {
    const repoInfo = parseRepositoryInfo();
    if (!repoInfo) return;

    const issueNumbers = extractIssueNumbers();
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
