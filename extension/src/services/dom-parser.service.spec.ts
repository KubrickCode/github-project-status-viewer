import { SELECTORS } from "../constants/ui";
import { extractIssueNumbers, parseRepositoryInfo } from "./dom-parser.service";

describe("dom-parser.service", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("extractIssueNumbers", () => {
    const createIssueLink = (issueNumber: number, customHref?: string): string => {
      const linkAttribute = SELECTORS.ISSUE_LINK.replace(/[[\]]/g, "");
      const href = customHref || `/owner/repo/issues/${issueNumber}`;
      return `<a ${linkAttribute} href="${href}">Issue #${issueNumber}</a>`;
    };

    it("should return empty array when no issue links exist", () => {
      document.body.innerHTML = "<div>No issues here</div>";

      const result = extractIssueNumbers();

      expect(result).toEqual([]);
    });

    it("should extract single issue number", () => {
      document.body.innerHTML = createIssueLink(123);

      const result = extractIssueNumbers();

      expect(result).toEqual([123]);
    });

    it("should extract multiple issue numbers", () => {
      document.body.innerHTML = `
        ${createIssueLink(1)}
        ${createIssueLink(42)}
        ${createIssueLink(999)}
      `;

      const result = extractIssueNumbers();

      expect(result).toEqual([1, 42, 999]);
    });

    it("should handle large issue numbers", () => {
      document.body.innerHTML = createIssueLink(9999999);

      const result = extractIssueNumbers();

      expect(result).toEqual([9999999]);
    });

    it("should skip links without href attribute", () => {
      const linkAttribute = SELECTORS.ISSUE_LINK.replace(/[[\]]/g, "");
      document.body.innerHTML = `
        <a ${linkAttribute}>No href</a>
        ${createIssueLink(123)}
      `;

      const result = extractIssueNumbers();

      expect(result).toEqual([123]);
    });

    it("should skip links with non-issue hrefs", () => {
      const linkAttribute = SELECTORS.ISSUE_LINK.replace(/[[\]]/g, "");
      document.body.innerHTML = `
        <a ${linkAttribute} href="/owner/repo/pulls/456">Pull Request</a>
        ${createIssueLink(123)}
      `;

      const result = extractIssueNumbers();

      expect(result).toEqual([123]);
    });

    it("should skip links with invalid issue number format", () => {
      const linkAttribute = SELECTORS.ISSUE_LINK.replace(/[[\]]/g, "");
      document.body.innerHTML = `
        <a ${linkAttribute} href="/owner/repo/issues/abc">Invalid</a>
        ${createIssueLink(123)}
      `;

      const result = extractIssueNumbers();

      expect(result).toEqual([123]);
    });

    it("should handle full GitHub URLs", () => {
      document.body.innerHTML = createIssueLink(123, "https://github.com/owner/repo/issues/123");

      const result = extractIssueNumbers();

      expect(result).toEqual([123]);
    });

    it("should handle relative URLs", () => {
      document.body.innerHTML = createIssueLink(456, "/owner/repo/issues/456");

      const result = extractIssueNumbers();

      expect(result).toEqual([456]);
    });

    it("should handle URLs with query parameters", () => {
      document.body.innerHTML = createIssueLink(789, "/owner/repo/issues/789?assignee=user");

      const result = extractIssueNumbers();

      expect(result).toEqual([789]);
    });

    it("should handle URLs with hash fragments", () => {
      document.body.innerHTML = createIssueLink(321, "/owner/repo/issues/321#issuecomment-123");

      const result = extractIssueNumbers();

      expect(result).toEqual([321]);
    });

    it("should extract numbers in order of DOM appearance", () => {
      document.body.innerHTML = `
        ${createIssueLink(3)}
        ${createIssueLink(1)}
        ${createIssueLink(2)}
      `;

      const result = extractIssueNumbers();

      expect(result).toEqual([3, 1, 2]);
    });

    it("should handle nested HTML structure", () => {
      document.body.innerHTML = `
        <div>
          <div>
            <div>
              ${createIssueLink(111)}
            </div>
          </div>
        </div>
        <section>
          ${createIssueLink(222)}
        </section>
      `;

      const result = extractIssueNumbers();

      expect(result).toEqual([111, 222]);
    });

    it("should handle duplicate issue numbers", () => {
      document.body.innerHTML = `
        ${createIssueLink(123)}
        ${createIssueLink(123)}
        ${createIssueLink(456)}
      `;

      const result = extractIssueNumbers();

      expect(result).toEqual([123, 123, 456]);
    });

    it("should handle issue number zero", () => {
      document.body.innerHTML = createIssueLink(0);

      const result = extractIssueNumbers();

      expect(result).toEqual([0]);
    });

    it("should handle mixed valid and invalid links", () => {
      const linkAttribute = SELECTORS.ISSUE_LINK.replace(/[[\]]/g, "");
      document.body.innerHTML = `
        ${createIssueLink(100)}
        <a ${linkAttribute} href="/invalid">Invalid</a>
        ${createIssueLink(200)}
        <a ${linkAttribute}>No href</a>
        ${createIssueLink(300)}
        <a ${linkAttribute} href="/owner/repo/issues/NaN">NaN</a>
        ${createIssueLink(400)}
      `;

      const result = extractIssueNumbers();

      expect(result).toEqual([100, 200, 300, 400]);
    });
  });

  describe("parseRepositoryInfo", () => {
    it("should parse owner and repo from valid pathname", () => {
      const result = parseRepositoryInfo("/owner/repo/issues");

      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
      });
    });

    it("should parse from pathname with page number", () => {
      const result = parseRepositoryInfo("/owner/repo/issues?page=2");

      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
      });
    });

    it("should parse from pathname with trailing slash", () => {
      const result = parseRepositoryInfo("/owner/repo/issues/");

      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
      });
    });

    it("should return null for non-issues pathname", () => {
      const result = parseRepositoryInfo("/owner/repo");

      expect(result).toBeNull();
    });

    it("should return null for pull requests pathname", () => {
      const result = parseRepositoryInfo("/owner/repo/pulls");

      expect(result).toBeNull();
    });

    it("should return null for root pathname", () => {
      const result = parseRepositoryInfo("/");

      expect(result).toBeNull();
    });

    it("should return null for empty pathname", () => {
      const result = parseRepositoryInfo("");

      expect(result).toBeNull();
    });

    it("should handle owner with hyphens", () => {
      const result = parseRepositoryInfo("/my-org/repo/issues");

      expect(result).toEqual({
        owner: "my-org",
        repo: "repo",
      });
    });

    it("should handle repo with hyphens", () => {
      const result = parseRepositoryInfo("/owner/my-repo/issues");

      expect(result).toEqual({
        owner: "owner",
        repo: "my-repo",
      });
    });

    it("should handle owner with dots", () => {
      const result = parseRepositoryInfo("/my.org/repo/issues");

      expect(result).toEqual({
        owner: "my.org",
        repo: "repo",
      });
    });

    it("should handle repo with dots", () => {
      const result = parseRepositoryInfo("/owner/my.repo/issues");

      expect(result).toEqual({
        owner: "owner",
        repo: "my.repo",
      });
    });

    it("should handle owner with underscores", () => {
      const result = parseRepositoryInfo("/my_org/repo/issues");

      expect(result).toEqual({
        owner: "my_org",
        repo: "repo",
      });
    });

    it("should handle repo with underscores", () => {
      const result = parseRepositoryInfo("/owner/my_repo/issues");

      expect(result).toEqual({
        owner: "owner",
        repo: "my_repo",
      });
    });

    it("should handle mixed special characters", () => {
      const result = parseRepositoryInfo("/my-org_test.v2/repo-name_v1.0/issues");

      expect(result).toEqual({
        owner: "my-org_test.v2",
        repo: "repo-name_v1.0",
      });
    });

    it("should return null for pathname with only owner", () => {
      const result = parseRepositoryInfo("/owner");

      expect(result).toBeNull();
    });

    it("should return null for malformed pathname", () => {
      const result = parseRepositoryInfo("///issues");

      expect(result).toBeNull();
    });

    it("should parse from pathname with query string", () => {
      const result = parseRepositoryInfo("/owner/repo/issues?state=open&label=bug");

      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
      });
    });

    it("should parse from pathname with hash", () => {
      const result = parseRepositoryInfo("/owner/repo/issues#top");

      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
      });
    });

    it("should use window.location.pathname when no argument provided", () => {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: { pathname: "/test-owner/test-repo/issues" },
        writable: true,
      });

      const result = parseRepositoryInfo();

      expect(result).toEqual({
        owner: "test-owner",
        repo: "test-repo",
      });
    });

    it("should handle numeric owner names", () => {
      const result = parseRepositoryInfo("/12345/repo/issues");

      expect(result).toEqual({
        owner: "12345",
        repo: "repo",
      });
    });

    it("should handle numeric repo names", () => {
      const result = parseRepositoryInfo("/owner/12345/issues");

      expect(result).toEqual({
        owner: "owner",
        repo: "12345",
      });
    });

    it("should handle single character owner and repo", () => {
      const result = parseRepositoryInfo("/a/b/issues");

      expect(result).toEqual({
        owner: "a",
        repo: "b",
      });
    });

    it("should handle long owner and repo names", () => {
      const longOwner = "a".repeat(50);
      const longRepo = "b".repeat(50);
      const result = parseRepositoryInfo(`/${longOwner}/${longRepo}/issues`);

      expect(result).toEqual({
        owner: longOwner,
        repo: longRepo,
      });
    });
  });
});
