import { getIssueNumbers } from "./issue-parser";

describe("issue-parser.ts - getIssueNumbers", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("should extract issue numbers from GitHub issue links", () => {
    document.body.innerHTML = `
      <div>
        <a href="/owner/repo/issues/123" data-testid="issue-pr-title-link">Issue #123</a>
        <a href="/owner/repo/issues/456" data-testid="issue-pr-title-link">Issue #456</a>
        <a href="/owner/repo/issues/789" data-testid="issue-pr-title-link">Issue #789</a>
      </div>
    `;

    const numbers = getIssueNumbers();
    expect(numbers).toEqual([123, 456, 789]);
  });

  it("should return empty array when no issue links exist", () => {
    document.body.innerHTML = `<div>No issues here</div>`;

    const numbers = getIssueNumbers();
    expect(numbers).toEqual([]);
  });

  it("should ignore non-issue links", () => {
    document.body.innerHTML = `
      <div>
        <a href="/owner/repo/issues/100" data-testid="issue-pr-title-link">Issue #100</a>
        <a href="/owner/repo/pull/200" data-testid="issue-pr-title-link">PR #200</a>
        <a href="/owner/repo/discussions/300" data-testid="issue-pr-title-link">Discussion #300</a>
      </div>
    `;

    const numbers = getIssueNumbers();
    expect(numbers).toEqual([100]);
  });

  it("should handle malformed href attributes", () => {
    document.body.innerHTML = `
      <div>
        <a href="/owner/repo/issues/42" data-testid="issue-pr-title-link">Valid Issue</a>
        <a href="" data-testid="issue-pr-title-link">Empty href</a>
        <a data-testid="issue-pr-title-link">No href</a>
        <a href="/owner/repo/issues/" data-testid="issue-pr-title-link">No number</a>
        <a href="/owner/repo/issues/abc" data-testid="issue-pr-title-link">Non-numeric</a>
      </div>
    `;

    const numbers = getIssueNumbers();
    expect(numbers).toEqual([42]);
  });
});
