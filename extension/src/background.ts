(() => {
  type Config = {
    pat: string;
  };

  type IssueStatus = {
    color: string | null;
    number: number;
    status: string | null;
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

  const GITHUB_API_URL = "https://api.github.com/graphql";
  const STATUS_FIELD_NAME = "Status";
  const CONFIG_ERROR_MESSAGE =
    "Configuration not found. Please set up your GitHub token in the extension popup.";
  const STORAGE_KEYS = ["pat"] as const;

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
    const issueStatusMap = new Map<
      number,
      { color: string | null; status: string }
    >();

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

  const fetchProjectStatus = async (
    config: Config,
    owner: string,
    repo: string,
    issueNumbers: number[]
  ): Promise<IssueStatus[]> => {
    console.log("[GitHub Project Status Background] Sending GraphQL query:", {
      issueNumbers,
      owner,
      repo,
    });

    const query = buildQuery(issueNumbers);

    const response = await fetch(GITHUB_API_URL, {
      body: JSON.stringify({
        query,
        variables: {
          name: repo,
          owner,
        },
      }),
      headers: {
        Authorization: `Bearer ${config.pat}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    console.log(
      "[GitHub Project Status Background] Response status:",
      response.status
    );

    const responseText = await response.text();
    console.log(
      "[GitHub Project Status Background] Response body:",
      responseText
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} - ${responseText}`);
    }

    const data: GraphQLResponse = JSON.parse(responseText);

    if (data.errors) {
      console.error(
        "[GitHub Project Status Background] GraphQL errors:",
        data.errors
      );
      throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
    }

    if (!data.data?.repository) {
      console.error(
        "[GitHub Project Status Background] Invalid response structure:",
        data
      );
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
    request: {
      issueNumbers: number[];
      owner: string;
      repo: string;
      type: string;
    },
    sendResponse: (response: {
      error?: string;
      statuses?: IssueStatus[];
    }) => void
  ) => {
    if (request.type !== "GET_PROJECT_STATUS") return false;

    console.log(
      "[GitHub Project Status Background] Received request:",
      request
    );

    try {
      const config = await chrome.storage.sync.get(STORAGE_KEYS);
      console.log("[GitHub Project Status Background] Config:", {
        hasPat: !!config.pat,
      });

      if (!config.pat) {
        console.error("[GitHub Project Status Background] No PAT found");
        sendResponse({ error: CONFIG_ERROR_MESSAGE });
        return true;
      }

      console.log(
        "[GitHub Project Status Background] Fetching project status for:",
        {
          owner: request.owner,
          repo: request.repo,
          issueCount: request.issueNumbers.length,
        }
      );

      const statuses = await fetchProjectStatus(
        config as Config,
        request.owner,
        request.repo,
        request.issueNumbers
      );

      console.log(
        "[GitHub Project Status Background] Fetched statuses:",
        statuses
      );
      sendResponse({ statuses });
    } catch (error) {
      console.error("[GitHub Project Status Background] Error:", error);
      sendResponse({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return true;
  };

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    handleMessage(request, sendResponse);
    return true;
  });
})();
