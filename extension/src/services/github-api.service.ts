import { API, GRAPHQL } from "../constants/api";
import { STORAGE_KEYS } from "../constants/storage";
import { IssueStatus, StatusOption } from "../shared/types";

const HTTP_STATUS_UNAUTHORIZED = 401;
const GRAPHQL_PROJECT_ITEMS_LIMIT = 10;
const GRAPHQL_FIELD_VALUES_LIMIT = 20;

const UPDATE_PROJECT_STATUS_MUTATION = `
  mutation($input: UpdateProjectV2ItemFieldValueInput!) {
    updateProjectV2ItemFieldValue(input: $input) {
      projectV2Item {
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
`;

type FetchProjectStatusParams = {
  accessToken: string;
  issueNumbers: number[];
  owner: string;
  refreshToken: string;
  repo: string;
};

type FieldValueNode = {
  color?: string;
  field?: {
    id?: string;
    name: string;
    options?: Array<{
      color: string;
      id: string;
      name: string;
    }>;
  };
  name?: string;
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
        nodes: FieldValueNode[];
      };
      id: string;
      project: {
        id: string;
      };
    }>;
  };
};

type RefreshResponse = {
  access_token: string;
  refresh_token: string;
};

type TokenError = Error & { status?: number };

type UpdateStatusParams = {
  accessToken: string;
  fieldId: string;
  itemId: string;
  optionId: string;
  projectId: string;
  refreshToken: string;
};

type UpdateStatusResponse = {
  data?: {
    updateProjectV2ItemFieldValue?: {
      projectV2Item?: {
        fieldValues: {
          nodes: FieldValueNode[];
        };
      };
    };
  };
  errors?: Array<{
    message: string;
    type?: string;
  }>;
};

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
  const githubAccessToken = await getValidGithubAccessToken(accessToken, refreshToken);

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
      projectId: statusData?.projectId || null,
      projectItemId: statusData?.projectItemId || null,
      status: statusData?.status || null,
      statusFieldId: statusData?.statusFieldId || null,
      statusOptions: statusData?.statusOptions || null,
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
            id
            project {
              id
            }
            fieldValues(first: ${GRAPHQL_FIELD_VALUES_LIMIT}) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  color
                  field {
                    ... on ProjectV2SingleSelectField {
                      id
                      name
                      options {
                        id
                        name
                        color
                      }
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

type IssueStatusData = {
  color: string | null;
  projectId: string | null;
  projectItemId: string | null;
  status: string;
  statusFieldId: string | null;
  statusOptions: StatusOption[] | null;
};

const buildIssueStatusMap = (issues: IssueNode[]): Map<number, IssueStatusData> => {
  const issueStatusMap = new Map<number, IssueStatusData>();

  issues.forEach((issue) => {
    if (!issue.number || !issue.projectItems.nodes.length) return;

    const firstProjectItem = issue.projectItems.nodes[0];
    const statusField = firstProjectItem.fieldValues.nodes.find(
      (node) => node.field?.name === GRAPHQL.STATUS_FIELD_NAME && node.name
    );

    if (statusField?.name) {
      const options: StatusOption[] | null = statusField.field?.options
        ? statusField.field.options.map((opt) => ({
            color: opt.color,
            id: opt.id,
            name: opt.name,
          }))
        : null;

      issueStatusMap.set(issue.number, {
        color: statusField.color || null,
        projectId: firstProjectItem.project?.id || null,
        projectItemId: firstProjectItem.id || null,
        status: statusField.name,
        statusFieldId: statusField.field?.id || null,
        statusOptions: options,
      });
    }
  });

  return issueStatusMap;
};

const isTokenError = (error: unknown): error is TokenError => {
  return error instanceof Error && "status" in error && typeof error.status === "number";
};

const getValidGithubAccessToken = async (
  accessToken: string,
  refreshToken: string
): Promise<string> => {
  try {
    return await getGithubAccessToken(accessToken);
  } catch (error) {
    if (isTokenError(error) && error.status === HTTP_STATUS_UNAUTHORIZED) {
      const tokens = await refreshTokens(refreshToken);

      await chrome.storage.session.set({
        [STORAGE_KEYS.ACCESS_TOKEN]: tokens.accessToken,
        [STORAGE_KEYS.REFRESH_TOKEN]: tokens.refreshToken,
      });

      return await getGithubAccessToken(tokens.accessToken);
    }
    throw error;
  }
};

export const updateProjectStatus = async ({
  accessToken,
  fieldId,
  itemId,
  optionId,
  projectId,
  refreshToken,
}: UpdateStatusParams): Promise<{ color: string; status: string }> => {
  if (!accessToken || !fieldId || !itemId || !optionId || !projectId || !refreshToken) {
    throw new Error("Missing required parameters for updateProjectStatus");
  }

  const githubAccessToken = await getValidGithubAccessToken(accessToken, refreshToken);

  const response = await fetch(API.GITHUB.GRAPHQL_URL, {
    body: JSON.stringify({
      query: UPDATE_PROJECT_STATUS_MUTATION,
      variables: {
        input: {
          fieldId,
          itemId,
          projectId,
          value: {
            singleSelectOptionId: optionId,
          },
        },
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

  const data: UpdateStatusResponse = JSON.parse(responseText);

  if (data.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
  }

  const fieldValues = data.data?.updateProjectV2ItemFieldValue?.projectV2Item?.fieldValues.nodes;
  const statusField = fieldValues?.find(
    (node) => node.field?.name === GRAPHQL.STATUS_FIELD_NAME && node.name
  );

  if (!statusField?.name) {
    throw new Error("Failed to get updated status");
  }

  return {
    color: statusField.color || "",
    status: statusField.name,
  };
};
