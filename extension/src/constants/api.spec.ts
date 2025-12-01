import { API, ERROR_MESSAGES, GRAPHQL } from "./api";

describe("API Constants", () => {
  describe("API", () => {
    it("should have valid URL formats", () => {
      const urlPattern = /^https?:\/\/.+/;
      expect(API.BASE_URL).toMatch(urlPattern);
      expect(API.GITHUB.GRAPHQL_URL).toMatch(urlPattern);
      expect(API.GITHUB.OAUTH_URL).toMatch(urlPattern);
    });

    it("should have valid GitHub Client ID", () => {
      expect(API.GITHUB.CLIENT_ID).toMatch(/^Ov23\w+/);
      expect(API.GITHUB.CLIENT_ID).toHaveLength(20);
    });

    it("should have valid OAuth scope", () => {
      expect(API.GITHUB.SCOPE).toContain("repo");
      expect(API.GITHUB.SCOPE).toContain("project");
    });

    it("should have correct structure", () => {
      expect(API.BASE_URL).toBeDefined();
      expect(API.GITHUB).toBeDefined();
      expect(API.GITHUB.GRAPHQL_URL).toBeDefined();
    });
  });

  describe("GRAPHQL", () => {
    it("should have valid field names", () => {
      expect(GRAPHQL.ISSUE_ALIAS_PREFIX).toBe("issue");
      expect(GRAPHQL.STATUS_FIELD_NAME).toBe("Status");
    });
  });

  describe("ERROR_MESSAGES", () => {
    it("should have user-friendly error messages", () => {
      expect(ERROR_MESSAGES.AUTH_REQUIRED).toContain("Authentication required");
      expect(ERROR_MESSAGES.AUTH_REQUIRED).toContain("Please log in");
    });

    it("should have correct structure", () => {
      // Verify the error message exists and is a string
      expect(typeof ERROR_MESSAGES.AUTH_REQUIRED).toBe("string");
      expect(ERROR_MESSAGES.AUTH_REQUIRED.length).toBeGreaterThan(0);
    });
  });
});
