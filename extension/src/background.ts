import { IssueStatus, MessageRequest, MessageResponse } from "./shared/types";

(() => {
  type VerifyResponse = {
    access_token: string;
  };

  type RefreshResponse = {
    access_token: string;
    refresh_token: string;
  };

  type GraphQLResponse = {
    data?: {
      repository?: {
        [key: string]: {
          number: number;
          projectItems: {
            nodes: Array<{
              fieldValues: {
                nodes: Array<{
                  color?: string;
                  field?: { name: string };
                  name?: string;
                }>;
              };
            }>;
          };
        };
      };
    };
    errors?: Array<{
      message: string;
      type?: string;
    }>;
  };

  const API_BASE_URL = "https://github-project-status-viewer.vercel.app/api";
  const GITHUB_API_URL = "https://api.github.com/graphql";
  const STATUS_FIELD_NAME = "Status";
  const ACCESS_TOKEN_KEY = "accessToken";
  const AUTH_ERROR_MESSAGE = "Authentication required. Please log in via the extension popup.";
  const REFRESH_TOKEN_KEY = "refreshToken";

  const buildQuery = (issueNumbers: number[]) => {
    const issueQueries = issueNumbers
      .map(
        (num, index) => `
      issue${index}: issue(number: ${num}) {
        number
        projectItems(first: 10) {
          nodes {
            fieldValues(first: 20) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  color
                  field {
                    ... on ProjectV2SingleSelectField {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    `
      )
      .join("\n");

    return `
      query($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          ${issueQueries}
        }
      }
    `;
  };

  type IssueNode = {
    number: number;
    projectItems: {
      nodes: Array<{
        fieldValues: {
          nodes: Array<{
            color?: string;
            field?: { name: string };
            name?: string;
          }>;
        };
      }>;
    };
  };

  const buildIssueStatusMap = (issues: IssueNode[]) => {
    const issueStatusMap = new Map<number, { color: string | null; status: string }>();

    issues.forEach((issue) => {
      if (!issue.number || !issue.projectItems.nodes.length) return;

      const firstProjectItem = issue.projectItems.nodes[0];
      const statusField = firstProjectItem.fieldValues.nodes.find(
        (node) => node.field?.name === STATUS_FIELD_NAME && node.name
      );

      if (statusField?.name) {
        issueStatusMap.set(issue.number, {
          color: statusField.color || null,
          status: statusField.name,
        });
      }
    });

    return issueStatusMap;
  };

  type TokenError = Error & { status?: number };

  const getGithubAccessToken = async (accessToken: string): Promise<string> => {
    const response = await fetch(`${API_BASE_URL}/verify`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      const error: TokenError = new Error(`Token verification failed: ${response.status}`);
      error.status = response.status;
      throw error;
    }

    const data: VerifyResponse = await response.json();
    return data.access_token;
  };

  const refreshTokens = async (
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string }> => {
    const response = await fetch(`${API_BASE_URL}/refresh`, {
      headers: {
        Authorization: `Bearer ${refreshToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const data: RefreshResponse = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  };

  const fetchProjectStatus = async (
    accessToken: string,
    refreshToken: string,
    owner: string,
    repo: string,
    issueNumbers: number[]
  ): Promise<IssueStatus[]> => {
    const query = buildQuery(issueNumbers);

    let githubAccessToken: string;
    let currentAccessToken = accessToken;
    let currentRefreshToken = refreshToken;

    try {
      githubAccessToken = await getGithubAccessToken(currentAccessToken);
    } catch (error) {
      const tokenError = error as TokenError;
      if (tokenError.status === 401) {
        const tokens = await refreshTokens(currentRefreshToken);
        currentAccessToken = tokens.accessToken;
        currentRefreshToken = tokens.refreshToken;

        await chrome.storage.session.set({
          [ACCESS_TOKEN_KEY]: currentAccessToken,
          [REFRESH_TOKEN_KEY]: currentRefreshToken,
        });

        githubAccessToken = await getGithubAccessToken(currentAccessToken);
      } else {
        throw error;
      }
    }

    const response = await fetch(GITHUB_API_URL, {
      body: JSON.stringify({
        query,
        variables: {
          name: repo,
          owner,
        },
      }),
      headers: {
        Authorization: `Bearer ${githubAccessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} - ${responseText}`);
    }

    const data: GraphQLResponse = JSON.parse(responseText);

    if (data.errors) {
      throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
    }

    if (!data.data?.repository) {
      throw new Error("Repository not found");
    }

    const issues: IssueNode[] = Object.entries(data.data.repository)
      .filter(([key]) => key.startsWith("issue"))
      .map(([, issue]) => issue as IssueNode);

    const issueStatusMap = buildIssueStatusMap(issues);

    return issueNumbers.map((number) => {
      const statusData = issueStatusMap.get(number);
      return {
        color: statusData?.color || null,
        number,
        status: statusData?.status || null,
      };
    });
  };

  const handleMessage = async (
    request: MessageRequest,
    sendResponse: (response: MessageResponse) => void
  ) => {
    if (request.type !== "GET_PROJECT_STATUS") return false;

    try {
      const result = await chrome.storage.session.get([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);

      if (!result[ACCESS_TOKEN_KEY] || !result[REFRESH_TOKEN_KEY]) {
        sendResponse({ error: AUTH_ERROR_MESSAGE });
        return true;
      }

      const statuses = await fetchProjectStatus(
        result[ACCESS_TOKEN_KEY],
        result[REFRESH_TOKEN_KEY],
        request.owner,
        request.repo,
        request.issueNumbers
      );

      sendResponse({ statuses });
    } catch (error) {
      sendResponse({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return true;
  };

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    handleMessage(request as MessageRequest, sendResponse);
    return true;
  });
})();
