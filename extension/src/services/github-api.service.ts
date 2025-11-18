import { API, GRAPHQL } from "../constants/api";
import { STORAGE_KEYS } from "../constants/storage";
import { IssueStatus } from "../shared/types";

const HTTP_STATUS_UNAUTHORIZED = 401;
const GRAPHQL_PROJECT_ITEMS_LIMIT = 10;
const GRAPHQL_FIELD_VALUES_LIMIT = 20;

type FetchProjectStatusParams = {
  accessToken: string;
  issueNumbers: number[];
  owner: string;
  refreshToken: string;
  repo: string;
};

type GraphQLResponse = {
  data?: {
    repository?: {
      [key: string]: IssueNode;
    };
  };
  errors?: Array<{
    message: string;
    type?: string;
  }>;
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

type RefreshResponse = {
  access_token: string;
  refresh_token: string;
};

type TokenError = Error & { status?: number };

type VerifyResponse = {
  access_token: string;
};

export const fetchProjectStatus = async ({
  accessToken,
  issueNumbers,
  owner,
  refreshToken,
  repo,
}: FetchProjectStatusParams): Promise<IssueStatus[]> => {
  const query = buildProjectStatusQuery(issueNumbers);

  let githubAccessToken: string;
  let currentAccessToken = accessToken;
  let currentRefreshToken = refreshToken;

  try {
    githubAccessToken = await getGithubAccessToken(currentAccessToken);
  } catch (error) {
    if (isTokenError(error) && error.status === HTTP_STATUS_UNAUTHORIZED) {
      const tokens = await refreshTokens(currentRefreshToken);
      currentAccessToken = tokens.accessToken;
      currentRefreshToken = tokens.refreshToken;

      await chrome.storage.session.set({
        [STORAGE_KEYS.ACCESS_TOKEN]: currentAccessToken,
        [STORAGE_KEYS.REFRESH_TOKEN]: currentRefreshToken,
      });

      githubAccessToken = await getGithubAccessToken(currentAccessToken);
    } else {
      throw error;
    }
  }

  const response = await fetch(API.GITHUB.GRAPHQL_URL, {
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
    .filter(([key]) => key.startsWith(GRAPHQL.ISSUE_ALIAS_PREFIX))
    .map(([, issue]) => issue);

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

export const buildProjectStatusQuery = (issueNumbers: number[]): string => {
  const issueQueries = issueNumbers
    .map(
      (num, index) => `
      ${GRAPHQL.ISSUE_ALIAS_PREFIX}${index}: issue(number: ${num}) {
        number
        projectItems(first: ${GRAPHQL_PROJECT_ITEMS_LIMIT}) {
          nodes {
            fieldValues(first: ${GRAPHQL_FIELD_VALUES_LIMIT}) {
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

export const getGithubAccessToken = async (accessToken: string): Promise<string> => {
  const response = await fetch(`${API.BASE_URL}/verify`, {
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

export const refreshTokens = async (
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string }> => {
  const response = await fetch(`${API.BASE_URL}/refresh`, {
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

const buildIssueStatusMap = (
  issues: IssueNode[]
): Map<number, { color: string | null; status: string }> => {
  const issueStatusMap = new Map<number, { color: string | null; status: string }>();

  issues.forEach((issue) => {
    if (!issue.number || !issue.projectItems.nodes.length) return;

    const firstProjectItem = issue.projectItems.nodes[0];
    const statusField = firstProjectItem.fieldValues.nodes.find(
      (node) => node.field?.name === GRAPHQL.STATUS_FIELD_NAME && node.name
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

const isTokenError = (error: unknown): error is TokenError => {
  return error instanceof Error && "status" in error && typeof error.status === "number";
};
