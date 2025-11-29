import { SELECTORS, URL_PATTERNS } from "../constants/ui";

type RepositoryInfo = {
  owner: string;
  repo: string;
};

export const extractIssueNumbers = (): number[] => {
  const issueElements = document.querySelectorAll(SELECTORS.ISSUE_LINK);

  return Array.from(issueElements).flatMap((element) => {
    const match = element.getAttribute("href")?.match(URL_PATTERNS.ISSUE_NUMBER);
    if (!match) return [];

    const issueNumber = parseInt(match[1], 10);
    return isNaN(issueNumber) ? [] : [issueNumber];
  });
};

export const parseRepositoryInfo = (
  pathname: string = window.location.pathname
): RepositoryInfo | null => {
  const match = pathname.match(URL_PATTERNS.REPO_PATH);
  if (!match) return null;

  return {
    owner: match[1],
    repo: match[2],
  };
};
