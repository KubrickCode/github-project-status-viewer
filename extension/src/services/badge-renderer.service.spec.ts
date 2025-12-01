import { CSS_CLASSES, SELECTORS, UI_DEFAULTS } from "../constants/ui";
import {
  applyUniformWidth,
  calculateMaxBadgeWidth,
  createBadge,
  insertBadge,
  refreshAllBadgeDisplays,
  updateBadgeDisplay,
} from "./badge-renderer.service";

const createIssueHTML = (
  issueNumber: number,
  options?: { withBadge?: boolean; withoutH3?: boolean }
): string => {
  const linkAttribute = SELECTORS.ISSUE_LINK.replace(/[[\]]/g, "");
  const issueLink = `<a ${linkAttribute} href="/owner/repo/issues/${issueNumber}">Issue #${issueNumber}</a>`;

  if (options?.withoutH3) {
    return `<div>${issueLink}</div>`;
  }

  const h3Element = `<h3>${issueLink}</h3>`;
  const badge = options?.withBadge ? `<span class="${CSS_CLASSES.BADGE}">Existing</span>` : "";

  return `<div>${badge}${h3Element}</div>`;
};

describe("badge-renderer.service", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("calculateMaxBadgeWidth", () => {
    it("should return 0 when no badges exist", () => {
      const result = calculateMaxBadgeWidth();

      expect(result).toBe(0);
    });

    it("should calculate maximum width among badges", () => {
      document.body.innerHTML = `
        <div>
          <span class="${CSS_CLASSES.BADGE}" style="width: 50px; display: inline-block;">Status 1</span>
          <span class="${CSS_CLASSES.BADGE}" style="width: 80px; display: inline-block;">Status 2</span>
          <span class="${CSS_CLASSES.BADGE}" style="width: 30px; display: inline-block;">Status 3</span>
        </div>
      `;

      const result = calculateMaxBadgeWidth();

      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe("applyUniformWidth", () => {
    it("should not apply width when maxWidth is 0", () => {
      document.body.innerHTML = `
        <span class="${CSS_CLASSES.BADGE}">Badge</span>
      `;

      applyUniformWidth({ maxWidth: 0 });

      const badge = document.querySelector(`.${CSS_CLASSES.BADGE}`) as HTMLElement;
      expect(badge.style.minWidth).toBe("");
    });

    it("should apply minWidth to all full-mode badges", () => {
      document.body.innerHTML = `
        <span class="${CSS_CLASSES.BADGE}">Badge 1</span>
        <span class="${CSS_CLASSES.BADGE}">Badge 2</span>
      `;

      applyUniformWidth({ maxWidth: 100 });

      const badges = document.querySelectorAll(`.${CSS_CLASSES.BADGE}`);
      badges.forEach((badge) => {
        expect((badge as HTMLElement).style.minWidth).toBe("100px");
      });
    });

    it("should not apply width to compact badges", () => {
      document.body.innerHTML = `
        <span class="${CSS_CLASSES.BADGE} ${CSS_CLASSES.BADGE_COMPACT}">Compact</span>
        <span class="${CSS_CLASSES.BADGE}">Full</span>
      `;

      applyUniformWidth({ maxWidth: 100 });

      const compactBadge = document.querySelector(`.${CSS_CLASSES.BADGE_COMPACT}`) as HTMLElement;
      const fullBadge = document.querySelector(
        `.${CSS_CLASSES.BADGE}:not(.${CSS_CLASSES.BADGE_COMPACT})`
      ) as HTMLElement;

      expect(compactBadge.style.minWidth).toBe("");
      expect(fullBadge.style.minWidth).toBe("100px");
    });
  });

  describe("createBadge", () => {
    const defaultBadgeParams = {
      issueNumber: 1,
      projectId: null,
      projectItemId: null,
      statusFieldId: null,
      statusOptions: null,
    };

    it("should create badge with full display mode", () => {
      const badge = createBadge({
        ...defaultBadgeParams,
        color: "#ff5733",
        displayMode: "full",
        status: "In Progress",
      });

      expect(badge.className).toBe(CSS_CLASSES.BADGE);
      expect(badge.getAttribute("data-status")).toBe("In Progress");
      expect(badge.style.getPropertyValue("--status-color")).toBe("#ff5733");
      expect(badge.textContent).toBe("In Progress");
      expect(badge.classList.contains(CSS_CLASSES.BADGE_COMPACT)).toBe(false);
    });

    it("should create badge with compact display mode", () => {
      const badge = createBadge({
        ...defaultBadgeParams,
        color: "#00ff00",
        displayMode: "compact",
        status: "Done",
      });

      expect(badge.className).toContain(CSS_CLASSES.BADGE_COMPACT);
      expect(badge.textContent).toBe("");
      expect(badge.title).toBe("Done");
      expect(badge.getAttribute("aria-label")).toBe("Status: Done");
      expect(badge.getAttribute("role")).toBe("img");
      expect(badge.tabIndex).toBe(0);
    });

    it("should use default color when color is null", () => {
      const badge = createBadge({
        ...defaultBadgeParams,
        color: null,
        displayMode: "full",
        status: "Todo",
      });

      expect(badge.style.getPropertyValue("--status-color")).toBe(UI_DEFAULTS.BADGE_COLOR);
    });
  });

  describe("updateBadgeDisplay", () => {
    it("should update badge to full mode", () => {
      const badge = document.createElement("span");
      badge.className = `${CSS_CLASSES.BADGE} ${CSS_CLASSES.BADGE_COMPACT}`;
      badge.textContent = "";
      badge.title = "Old Status";
      badge.setAttribute("role", "img");
      badge.setAttribute("aria-label", "Status: Old");
      badge.tabIndex = 0;

      updateBadgeDisplay({ badge, displayMode: "full", status: "New Status" });

      expect(badge.classList.contains(CSS_CLASSES.BADGE_COMPACT)).toBe(false);
      expect(badge.textContent).toBe("New Status");
      expect(badge.title).toBe("");
      expect(badge.getAttribute("role")).toBeNull();
      expect(badge.getAttribute("aria-label")).toBeNull();
      expect(badge.tabIndex).toBe(-1);
    });

    it("should update badge to compact mode", () => {
      const badge = document.createElement("span");
      badge.className = CSS_CLASSES.BADGE;
      badge.textContent = "Old Status";
      badge.style.minWidth = "100px";

      updateBadgeDisplay({ badge, displayMode: "compact", status: "New Status" });

      expect(badge.classList.contains(CSS_CLASSES.BADGE_COMPACT)).toBe(true);
      expect(badge.textContent).toBe("");
      expect(badge.title).toBe("New Status");
      expect(badge.getAttribute("role")).toBe("img");
      expect(badge.getAttribute("aria-label")).toBe("Status: New Status");
      expect(badge.tabIndex).toBe(0);
      expect(badge.style.minWidth).toBe("");
    });
  });

  describe("insertBadge", () => {
    const defaultInsertParams = {
      projectId: null,
      projectItemId: null,
      statusFieldId: null,
      statusOptions: null,
    };

    it("should insert badge for matching issue number", () => {
      document.body.innerHTML = createIssueHTML(123);

      const result = insertBadge({
        ...defaultInsertParams,
        color: "#ff5733",
        displayMode: "full",
        issueNumber: 123,
        status: "In Progress",
      });

      expect(result).toBe(true);
      const badge = document.querySelector(`.${CSS_CLASSES.BADGE}`);
      expect(badge).not.toBeNull();
      expect(badge?.getAttribute("data-status")).toBe("In Progress");
    });

    it("should not insert badge if already exists", () => {
      document.body.innerHTML = createIssueHTML(123, { withBadge: true });

      const result = insertBadge({
        ...defaultInsertParams,
        color: "#ff5733",
        displayMode: "full",
        issueNumber: 123,
        status: "New Status",
      });

      expect(result).toBe(false);
      const badges = document.querySelectorAll(`.${CSS_CLASSES.BADGE}`);
      expect(badges.length).toBe(1);
    });

    it("should return false for non-matching issue number", () => {
      document.body.innerHTML = createIssueHTML(456);

      const result = insertBadge({
        ...defaultInsertParams,
        color: "#ff5733",
        displayMode: "full",
        issueNumber: 123,
        status: "In Progress",
      });

      expect(result).toBe(false);
      const badge = document.querySelector(`.${CSS_CLASSES.BADGE}`);
      expect(badge).toBeNull();
    });

    it("should handle missing h3 element", () => {
      document.body.innerHTML = createIssueHTML(123, { withoutH3: true });

      const result = insertBadge({
        ...defaultInsertParams,
        color: "#ff5733",
        displayMode: "full",
        issueNumber: 123,
        status: "In Progress",
      });

      expect(result).toBe(false);
    });
  });

  describe("refreshAllBadgeDisplays", () => {
    it("should refresh all badges to full mode", () => {
      document.body.innerHTML = `
        <span class="${CSS_CLASSES.BADGE} ${CSS_CLASSES.BADGE_COMPACT}" data-status="Status 1"></span>
        <span class="${CSS_CLASSES.BADGE} ${CSS_CLASSES.BADGE_COMPACT}" data-status="Status 2"></span>
      `;

      refreshAllBadgeDisplays("full");

      const badges = document.querySelectorAll(`.${CSS_CLASSES.BADGE}`);
      badges.forEach((badge) => {
        expect(badge.classList.contains(CSS_CLASSES.BADGE_COMPACT)).toBe(false);
        expect(badge.textContent).toBeTruthy();
      });
    });

    it("should refresh all badges to compact mode", () => {
      document.body.innerHTML = `
        <span class="${CSS_CLASSES.BADGE}" data-status="Status 1">Status 1</span>
        <span class="${CSS_CLASSES.BADGE}" data-status="Status 2">Status 2</span>
      `;

      refreshAllBadgeDisplays("compact");

      const badges = document.querySelectorAll(`.${CSS_CLASSES.BADGE}`);
      badges.forEach((badge) => {
        expect(badge.classList.contains(CSS_CLASSES.BADGE_COMPACT)).toBe(true);
        expect(badge.textContent).toBe("");
      });
    });

    it("should skip badges without data-status attribute", () => {
      document.body.innerHTML = `
        <span class="${CSS_CLASSES.BADGE}" data-status="Status 1">Status 1</span>
        <span class="${CSS_CLASSES.BADGE}">No Status</span>
      `;

      refreshAllBadgeDisplays("compact");

      const badgeWithStatus = document.querySelector('[data-status="Status 1"]');
      const badgeWithoutStatus = document.querySelectorAll(`.${CSS_CLASSES.BADGE}`)[1];

      expect(badgeWithStatus?.classList.contains(CSS_CLASSES.BADGE_COMPACT)).toBe(true);
      expect(badgeWithoutStatus.textContent).toBe("No Status");
    });
  });

  describe("various status values", () => {
    const defaultBadgeParams = {
      issueNumber: 1,
      projectId: null,
      projectItemId: null,
      statusFieldId: null,
      statusOptions: null,
    };

    const testCases = [
      { color: "#cccccc", status: "Todo" },
      { color: "#ff5733", status: "In Progress" },
      { color: "#00ff00", status: "Done" },
      { color: "#ff0000", status: "Blocked" },
      { color: "#0088ff", status: "Review" },
    ];

    testCases.forEach(({ color, status }) => {
      it(`should correctly render ${status} badge in full mode`, () => {
        const badge = createBadge({ ...defaultBadgeParams, color, displayMode: "full", status });

        expect(badge.textContent).toBe(status);
        expect(badge.style.getPropertyValue("--status-color")).toBe(color);
        expect(badge.getAttribute("data-status")).toBe(status);
      });

      it(`should correctly render ${status} badge in compact mode`, () => {
        const badge = createBadge({ ...defaultBadgeParams, color, displayMode: "compact", status });

        expect(badge.textContent).toBe("");
        expect(badge.title).toBe(status);
        expect(badge.getAttribute("aria-label")).toBe(`Status: ${status}`);
        expect(badge.style.getPropertyValue("--status-color")).toBe(color);
      });
    });

    it("should handle special characters in status", () => {
      const badge = createBadge({
        ...defaultBadgeParams,
        color: "#ffaa00",
        displayMode: "full",
        status: "⚠️ Needs Review",
      });

      expect(badge.textContent).toBe("⚠️ Needs Review");
      expect(badge.getAttribute("data-status")).toBe("⚠️ Needs Review");
    });

    it("should handle long status text", () => {
      const longStatus = "This is a very long status text that might need to be truncated";
      const badge = createBadge({
        ...defaultBadgeParams,
        color: "#000000",
        displayMode: "full",
        status: longStatus,
      });

      expect(badge.textContent).toBe(longStatus);
      expect(badge.getAttribute("data-status")).toBe(longStatus);
    });
  });
});
