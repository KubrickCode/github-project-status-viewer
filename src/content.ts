(() => {
  type IssueStatus = {
    number: number;
    status: string | null;
  };

  const GITHUB_ISSUES_URL_PATTERN =
    /https:\/\/github\.com\/[^/]+\/[^/]+\/issues/;
  const BADGE_CLASS = "project-status-badge";

  const STATUS_COLORS = [
    "#0969da", // blue
    "#1a7f37", // green
    "#bf8700", // yellow
    "#8250df", // purple
    "#cf222e", // red
    "#fb8500", // orange
    "#0550ae", // dark blue
    "#116329", // dark green
    "#6e7781", // gray
  ];

  const getStatusColor = (status: string): string => {
    let hash = 0;
    for (let i = 0; i < status.length; i++) {
      hash = (hash << 5) - hash + status.charCodeAt(i);
      hash = hash & hash;
    }
    return STATUS_COLORS[Math.abs(hash) % STATUS_COLORS.length];
  };

  const getIssueNumbers = (): number[] => {
    const issueElements = document.querySelectorAll(
      '[data-testid="issue-pr-title-link"]'
    );

    console.log(
      "[GitHub Project Status] Found issue links:",
      issueElements.length
    );

    const numbers: number[] = [];

    issueElements.forEach((element) => {
      const href = element.getAttribute("href");
      if (href) {
        const match = href.match(/\/issues\/(\d+)/);
        if (match) {
          const issueNumber = parseInt(match[1], 10);
          numbers.push(issueNumber);
          console.log(`[GitHub Project Status] Found issue #${issueNumber}`);
        }
      }
    });

    console.log("[GitHub Project Status] Parsed issue numbers:", numbers);
    return numbers;
  };

  const addStatusBadge = (issueNumber: number, status: string) => {
    const issueLinks = document.querySelectorAll(
      '[data-testid="issue-pr-title-link"]'
    );

    for (const link of Array.from(issueLinks)) {
      const href = link.getAttribute("href");
      if (!href?.includes(`/issues/${issueNumber}`)) continue;

      const parent = link.parentElement;
      if (!parent) {
        console.log(
          `[GitHub Project Status] No parent element for issue #${issueNumber}`
        );
        continue;
      }

      if (parent.querySelector(`.${BADGE_CLASS}`)) {
        console.log(
          `[GitHub Project Status] Badge already exists for issue #${issueNumber}`
        );
        return;
      }

      const badge = document.createElement("span");
      badge.className = BADGE_CLASS;
      badge.textContent = status;
      badge.style.backgroundColor = getStatusColor(status);

      parent.appendChild(badge);
      console.log(
        `[GitHub Project Status] Added badge for issue #${issueNumber}: ${status}`
      );
      return;
    }

    console.log(
      `[GitHub Project Status] Could not find link for issue #${issueNumber}`
    );
  };

  const parseRepoInfo = () => {
    const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)\/issues/);
    if (!match) {
      console.log(
        "[GitHub Project Status] Could not parse repo info from:",
        window.location.pathname
      );
      return null;
    }

    const info = {
      owner: match[1],
      repo: match[2],
    };

    console.log("[GitHub Project Status] Parsed repo info:", info);
    return info;
  };

  const updateIssueStatuses = async () => {
    console.log("[GitHub Project Status] Starting updateIssueStatuses");

    const repoInfo = parseRepoInfo();
    if (!repoInfo) return;

    const issueNumbers = getIssueNumbers();
    if (issueNumbers.length === 0) {
      console.log("[GitHub Project Status] No issues found");
      return;
    }

    console.log(
      "[GitHub Project Status] Requesting status for issues:",
      issueNumbers
    );

    try {
      const response = await chrome.runtime.sendMessage({
        issueNumbers,
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        type: "GET_PROJECT_STATUS",
      });

      console.log("[GitHub Project Status] Received response:", response);

      if (response.error) {
        console.error("[GitHub Project Status] Error:", response.error);
        return;
      }

      const statuses: IssueStatus[] = response.statuses;
      console.log("[GitHub Project Status] Processing statuses:", statuses);

      statuses.forEach(({ number, status }) => {
        if (status) {
          console.log(
            `[GitHub Project Status] Adding badge for issue #${number}: ${status}`
          );
          addStatusBadge(number, status);
        }
      });

      console.log("[GitHub Project Status] Updated", statuses.length, "issues");
    } catch (error) {
      console.error("[GitHub Project Status] Failed to fetch statuses:", error);
    }
  };

  const init = () => {
    if (!window.location.href.match(GITHUB_ISSUES_URL_PATTERN)) return;

    console.log("[GitHub Project Status] Extension loaded on issues page");

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
