import { STORAGE_KEYS } from "./constants/storage";
import { CSS_CLASSES, SELECTORS, UI_TIMING, URL_PATTERNS } from "./constants/ui";
import {
  applyUniformWidth,
  calculateMaxBadgeWidth,
  insertBadge,
  refreshAllBadgeDisplays,
  updateBadgeStatus,
} from "./services/badge-renderer.service";
import { extractIssueNumbers, parseRepositoryInfo } from "./services/dom-parser.service";
import { closeDropdown, showDropdown } from "./services/status-dropdown.service";
import {
  DisplayMode,
  GetProjectStatusRequest,
  MessageResponse,
  StatusOption,
  UpdateProjectStatusRequest,
} from "./shared/types";

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

  const handleBadgeClick = (params: {
    badge: HTMLElement;
    currentStatus: string;
    issueNumber: number;
    projectId: string;
    projectItemId: string;
    statusFieldId: string;
    statusOptions: StatusOption[];
  }) => {
    const repoInfo = parseRepositoryInfo();
    if (!repoInfo) return;

    const currentStatusFromBadge = params.badge.getAttribute("data-status") || params.currentStatus;

    showDropdown({
      anchor: params.badge,
      currentStatus: currentStatusFromBadge,
      onSelect: async (option: StatusOption) => {
        if (option.name === currentStatusFromBadge) {
          closeDropdown();
          return;
        }

        closeDropdown();
        updateBadgeStatus({
          issueNumber: params.issueNumber,
          newColor: option.color,
          newStatus: option.name,
        });

        const request: UpdateProjectStatusRequest = {
          fieldId: params.statusFieldId,
          issueNumber: params.issueNumber,
          itemId: params.projectItemId,
          optionId: option.id,
          owner: repoInfo.owner,
          projectId: params.projectId,
          repo: repoInfo.repo,
          type: "UPDATE_PROJECT_STATUS",
        };

        try {
          const response: MessageResponse = await chrome.runtime.sendMessage(request);

          if (response.error) {
            console.error("Failed to update status:", response.error);
            updateBadgeStatus({
              issueNumber: params.issueNumber,
              newColor: null,
              newStatus: currentStatusFromBadge,
            });
            return;
          }

          if (response.updatedStatus) {
            updateBadgeStatus({
              issueNumber: params.issueNumber,
              newColor: response.updatedStatus.color,
              newStatus: response.updatedStatus.status,
            });
          }
        } catch (error) {
          console.error("Failed to update status:", error);
          updateBadgeStatus({
            issueNumber: params.issueNumber,
            newColor: null,
            newStatus: currentStatusFromBadge,
          });
        }
      },
      options: params.statusOptions,
    });
  };

  const addStatusBadge = async (params: {
    color: string | null;
    issueNumber: number;
    projectId: string | null;
    projectItemId: string | null;
    status: string;
    statusFieldId: string | null;
    statusOptions: StatusOption[] | null;
  }) => {
    const displayMode = await getDisplayMode();
    insertBadge({
      color: params.color,
      displayMode,
      issueNumber: params.issueNumber,
      onBadgeClick: handleBadgeClick,
      projectId: params.projectId,
      projectItemId: params.projectItemId,
      status: params.status,
      statusFieldId: params.statusFieldId,
      statusOptions: params.statusOptions,
    });
  };

  const updateIssueStatuses = async () => {
    const repoInfo = parseRepositoryInfo();
    if (!repoInfo) return;

    const issueNumbers = extractIssueNumbers();
    if (issueNumbers.length === 0) return;

    if (isProcessing) return;

    isProcessing = true;

    try {
      const request: GetProjectStatusRequest = {
        issueNumbers,
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        type: "GET_PROJECT_STATUS",
      };

      const response: MessageResponse = await chrome.runtime.sendMessage(request);

      if (response.error) return;

      const statuses = response.statuses || [];

      for (const {
        color,
        number,
        projectId,
        projectItemId,
        status,
        statusFieldId,
        statusOptions,
      } of statuses) {
        if (status) {
          await addStatusBadge({
            color,
            issueNumber: number,
            projectId,
            projectItemId,
            status,
            statusFieldId,
            statusOptions,
          });
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
