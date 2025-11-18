import {
  CSS_CLASSES,
  ELEMENT_IDS,
  SELECTORS,
  STATUS_ICONS,
  UI_DEFAULTS,
  UI_TIMING,
  URL_PATTERNS,
} from "./ui";

describe("UI Constants", () => {
  describe("CSS_CLASSES", () => {
    it("should have valid CSS class name format", () => {
      const validClassFormat = /^[a-z][a-z0-9-_]*$/;
      expect(CSS_CLASSES.BADGE).toMatch(validClassFormat);
      expect(CSS_CLASSES.BADGE_COMPACT).toMatch(validClassFormat);
      expect(CSS_CLASSES.POPUP.ACTIVE).toMatch(validClassFormat);
      expect(CSS_CLASSES.POPUP.LOADING).toMatch(validClassFormat);
      expect(CSS_CLASSES.POPUP.SUCCESS_PULSE).toMatch(validClassFormat);
      expect(CSS_CLASSES.POPUP.VISIBLE).toMatch(validClassFormat);
    });

    it("should follow BEM naming convention", () => {
      const bemPattern = /^[a-z][a-z0-9-]*(__[a-z][a-z0-9-]*)*(--[a-z][a-z0-9-]*)*$/;
      expect(CSS_CLASSES.BADGE).toMatch(bemPattern);
      expect(CSS_CLASSES.BADGE_COMPACT).toMatch(bemPattern);
      Object.values(CSS_CLASSES.POPUP).forEach((className) => {
        expect(className).toMatch(bemPattern);
      });
    });
  });

  describe("SELECTORS", () => {
    it("should have valid CSS selector format", () => {
      expect(SELECTORS.ISSUE_LINK).toContain("[");
      expect(SELECTORS.ISSUE_LINK).toContain("data-testid");
      expect(SELECTORS.ISSUE_LINK).toContain("]");
    });
  });

  describe("ELEMENT_IDS", () => {
    it("should have camelCase format", () => {
      const camelCaseFormat = /^[a-z][a-zA-Z0-9]*$/;
      Object.values(ELEMENT_IDS).forEach((id) => {
        expect(id).toMatch(camelCaseFormat);
      });
    });

    it("should have unique values", () => {
      const values = Object.values(ELEMENT_IDS);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });

  describe("STATUS_ICONS", () => {
    it("should have SVG path data for each status", () => {
      const svgPathFormat = /^[MmLlHhVvCcSsQqTtAaZz0-9,.\s-]+$/;
      expect(STATUS_ICONS.error).toMatch(svgPathFormat);
      expect(STATUS_ICONS.info).toMatch(svgPathFormat);
      expect(STATUS_ICONS.success).toMatch(svgPathFormat);
    });

    it("should have paths starting with M (move command)", () => {
      Object.values(STATUS_ICONS).forEach((path) => {
        expect(path.startsWith("M")).toBe(true);
      });
    });
  });

  describe("UI_TIMING", () => {
    it("should have positive millisecond values", () => {
      Object.values(UI_TIMING).forEach((value) => {
        expect(value).toBeGreaterThan(0);
        expect(Number.isInteger(value)).toBe(true);
      });
    });

    it("should have reasonable timing values", () => {
      expect(UI_TIMING.DEBOUNCE_DELAY).toBeGreaterThanOrEqual(100);
      expect(UI_TIMING.DEBOUNCE_DELAY).toBeLessThanOrEqual(1000);
      expect(UI_TIMING.POLL_INTERVAL).toBeGreaterThanOrEqual(100);
      expect(UI_TIMING.POLL_INTERVAL).toBeLessThanOrEqual(1000);
      expect(UI_TIMING.POLL_TIMEOUT).toBeGreaterThanOrEqual(1000);
      expect(UI_TIMING.STATUS_DISPLAY_DURATION).toBeGreaterThanOrEqual(1000);
    });
  });

  describe("UI_DEFAULTS", () => {
    it("should have valid hex color format", () => {
      expect(UI_DEFAULTS.BADGE_COLOR).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it("should have valid display mode", () => {
      expect(["full", "compact"]).toContain(UI_DEFAULTS.DISPLAY_MODE);
    });
  });

  describe("URL_PATTERNS", () => {
    it("should be valid RegExp objects", () => {
      expect(URL_PATTERNS.GITHUB_ISSUES).toBeInstanceOf(RegExp);
      expect(URL_PATTERNS.REPO_PATH).toBeInstanceOf(RegExp);
    });

    it("should match correct GitHub URLs", () => {
      const validIssuesUrl = "https://github.com/owner/repo/issues";
      const invalidUrl = "https://example.com/issues";

      expect(URL_PATTERNS.GITHUB_ISSUES.test(validIssuesUrl)).toBe(true);
      expect(URL_PATTERNS.GITHUB_ISSUES.test(invalidUrl)).toBe(false);
    });

    it("should extract repo info from path", () => {
      const path = "/owner/repo/issues";
      const match = path.match(URL_PATTERNS.REPO_PATH);

      expect(match).toBeTruthy();
      expect(match?.[1]).toBe("owner");
      expect(match?.[2]).toBe("repo");
    });
  });
});
