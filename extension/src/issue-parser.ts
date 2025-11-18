export const getIssueNumbers = (): number[] => {
  const ISSUE_LINK_SELECTOR = '[data-testid="issue-pr-title-link"]';
  const issueElements = document.querySelectorAll(ISSUE_LINK_SELECTOR);

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
