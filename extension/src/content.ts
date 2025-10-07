(() => {
  type IssueStatus = {
    color: string | null;
    number: number;
    status: string | null;
  };

  type MessageRequest = {
    issueNumbers: number[];
    owner: string;
    repo: string;
    type: "GET_PROJECT_STATUS";
  };

  type MessageResponse = {
    error?: string;
    statuses?: IssueStatus[];
  };

  const GITHUB_ISSUES_URL_PATTERN =
    /https:\/\/github\.com\/[^/]+\/[^/]+\/issues/;
  const BADGE_CLASS = "project-status-badge";
  const DEFAULT_BADGE_COLOR = "#6e7781";

  const getIssueNumbers = (): number[] => {
    const issueElements = document.querySelectorAll(
      '[data-testid="issue-pr-title-link"]'
    );

    const numbers: number[] = [];

    issueElements.forEach((element) => {
      const href = element.getAttribute("href");
      if (href) {
        const match = href.match(/\/issues\/(\d+)/);
        if (match) {
          const issueNumber = parseInt(match[1], 10);
          numbers.push(issueNumber);
        }
      }
    });

    return numbers;
  };

  const calculateMaxBadgeWidth = (): number => {
    const badges = document.querySelectorAll(`.${BADGE_CLASS}`);
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

  const updateBadgeWidths = () => {
    const maxWidth = calculateMaxBadgeWidth();
    if (maxWidth === 0) return;

    const badges = document.querySelectorAll(`.${BADGE_CLASS}`);
    badges.forEach((badge) => {
      (badge as HTMLElement).style.minWidth = `${maxWidth}px`;
    });
  };

  const addStatusBadge = (
    issueNumber: number,
    status: string,
    color: string | null
  ) => {
    const issueLinks = document.querySelectorAll(
      '[data-testid="issue-pr-title-link"]'
    );

    for (const link of Array.from(issueLinks)) {
      const href = link.getAttribute("href");
      if (!href?.includes(`/issues/${issueNumber}`)) continue;

      const h3Element = link.closest("h3");
      if (!h3Element) continue;

      const container = h3Element.parentElement;
      if (!container) continue;

      if (container.querySelector(`.${BADGE_CLASS}`)) return;

      const badge = document.createElement("span");
      badge.className = BADGE_CLASS;
      badge.textContent = status;
      badge.style.setProperty("--status-color", color || DEFAULT_BADGE_COLOR);

      container.insertBefore(badge, h3Element);
      return;
    }
  };

  const parseRepoInfo = () => {
    const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)\/issues/);
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

    try {
      const request: MessageRequest = {
        issueNumbers,
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        type: "GET_PROJECT_STATUS",
      };

      const response: MessageResponse = await chrome.runtime.sendMessage(
        request
      );

      if (response.error) return;

      const statuses = response.statuses || [];

      statuses.forEach(({ color, number, status }) => {
        if (status) {
          addStatusBadge(number, status, color);
        }
      });

      requestAnimationFrame(() => {
        updateBadgeWidths();
      });
    } catch (error) {
      // Silent fail
    }
  };

  const init = () => {
    if (!window.location.href.match(GITHUB_ISSUES_URL_PATTERN)) return;

    updateIssueStatuses();

    const observer = new MutationObserver(() => {
      updateIssueStatuses();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  };

  init();
})();
