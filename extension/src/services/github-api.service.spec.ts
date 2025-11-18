import { API, GRAPHQL } from "../constants/api";
import { STORAGE_KEYS } from "../constants/storage";
import {
  buildProjectStatusQuery,
  fetchProjectStatus,
  getGithubAccessToken,
  refreshTokens,
} from "./github-api.service";

const mockChromeStorage = {
  session: {
    set: jest.fn(),
  },
};

Object.assign(globalThis, {
  chrome: {
    storage: mockChromeStorage,
  },
});

globalThis.fetch = jest.fn() as jest.Mock;

describe("github-api.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("buildProjectStatusQuery", () => {
    it("단일 이슈 번호에 대한 GraphQL 쿼리 생성", () => {
      const query = buildProjectStatusQuery([123]);

      expect(query).toContain("query($owner: String!, $name: String!)");
      expect(query).toContain(`${GRAPHQL.ISSUE_ALIAS_PREFIX}0: issue(number: 123)`);
      expect(query).toContain("projectItems(first: 10)");
      expect(query).toContain("fieldValues(first: 20)");
    });

    it("여러 이슈 번호에 대한 GraphQL 쿼리 생성", () => {
      const query = buildProjectStatusQuery([1, 2, 3]);

      expect(query).toContain(`${GRAPHQL.ISSUE_ALIAS_PREFIX}0: issue(number: 1)`);
      expect(query).toContain(`${GRAPHQL.ISSUE_ALIAS_PREFIX}1: issue(number: 2)`);
      expect(query).toContain(`${GRAPHQL.ISSUE_ALIAS_PREFIX}2: issue(number: 3)`);
    });

    it("빈 배열에 대한 쿼리 생성", () => {
      const query = buildProjectStatusQuery([]);

      expect(query).toContain("query($owner: String!, $name: String!)");
      expect(query).toContain("repository(owner: $owner, name: $name)");
    });
  });

  describe("getGithubAccessToken", () => {
    it("유효한 토큰으로 GitHub 액세스 토큰 가져오기", async () => {
      const mockAccessToken = "mock_github_token";
      (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({ access_token: mockAccessToken }),
        ok: true,
      });

      const result = await getGithubAccessToken("valid_token");

      expect(result).toBe(mockAccessToken);
      expect(globalThis.fetch).toHaveBeenCalledWith(`${API.BASE_URL}/verify`, {
        headers: {
          Authorization: "Bearer valid_token",
          "Content-Type": "application/json",
        },
        method: "POST",
      });
    });

    it("토큰 검증 실패 시 status를 포함한 에러 발생", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await expect(getGithubAccessToken("invalid_token")).rejects.toThrow(
        "Token verification failed: 401"
      );
    });

    it("토큰 검증 실패 시 status 프로퍼티 포함", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      try {
        await getGithubAccessToken("forbidden_token");
      } catch (error) {
        expect((error as { status?: number }).status).toBe(403);
      }
    });
  });

  describe("refreshTokens", () => {
    it("리프레시 토큰으로 새 토큰 획득", async () => {
      const mockTokens = {
        access_token: "new_access_token",
        refresh_token: "new_refresh_token",
      };
      (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => mockTokens,
        ok: true,
      });

      const result = await refreshTokens("valid_refresh_token");

      expect(result).toEqual({
        accessToken: "new_access_token",
        refreshToken: "new_refresh_token",
      });
      expect(globalThis.fetch).toHaveBeenCalledWith(`${API.BASE_URL}/refresh`, {
        headers: {
          Authorization: "Bearer valid_refresh_token",
          "Content-Type": "application/json",
        },
        method: "POST",
      });
    });

    it("토큰 갱신 실패 시 에러 발생", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await expect(refreshTokens("invalid_refresh_token")).rejects.toThrow(
        "Token refresh failed: 401"
      );
    });
  });

  describe("fetchProjectStatus", () => {
    const mockGraphQLResponse = {
      data: {
        repository: {
          issue0: {
            number: 1,
            projectItems: {
              nodes: [
                {
                  fieldValues: {
                    nodes: [
                      {
                        color: "GREEN",
                        field: { name: "Status" },
                        name: "Done",
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    };

    it("프로젝트 상태 조회 성공", async () => {
      (globalThis.fetch as jest.Mock)
        .mockResolvedValueOnce({
          json: async () => ({ access_token: "github_token" }),
          ok: true,
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify(mockGraphQLResponse),
        });

      const result = await fetchProjectStatus({
        accessToken: "access_token",
        issueNumbers: [1],
        owner: "owner",
        refreshToken: "refresh_token",
        repo: "repo",
      });

      expect(result).toEqual([
        {
          color: "GREEN",
          number: 1,
          status: "Done",
        },
      ]);
    });

    it("토큰 만료 시 자동 갱신 후 재시도", async () => {
      (globalThis.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
        })
        .mockResolvedValueOnce({
          json: async () => ({
            access_token: "new_access_token",
            refresh_token: "new_refresh_token",
          }),
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({ access_token: "github_token" }),
          ok: true,
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify(mockGraphQLResponse),
        });

      const result = await fetchProjectStatus({
        accessToken: "expired_token",
        issueNumbers: [1],
        owner: "owner",
        refreshToken: "refresh_token",
        repo: "repo",
      });

      expect(mockChromeStorage.session.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.ACCESS_TOKEN]: "new_access_token",
        [STORAGE_KEYS.REFRESH_TOKEN]: "new_refresh_token",
      });
      expect(result).toEqual([
        {
          color: "GREEN",
          number: 1,
          status: "Done",
        },
      ]);
    });

    it("GraphQL 에러 발생 시 에러 처리", async () => {
      (globalThis.fetch as jest.Mock)
        .mockResolvedValueOnce({
          json: async () => ({ access_token: "github_token" }),
          ok: true,
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
            JSON.stringify({
              errors: [{ message: "Field 'repository' not found", type: "NOT_FOUND" }],
            }),
        });

      await expect(
        fetchProjectStatus({
          accessToken: "access_token",
          issueNumbers: [1],
          owner: "owner",
          refreshToken: "refresh_token",
          repo: "repo",
        })
      ).rejects.toThrow("GraphQL error");
    });

    it("저장소를 찾을 수 없을 때 에러 처리", async () => {
      (globalThis.fetch as jest.Mock)
        .mockResolvedValueOnce({
          json: async () => ({ access_token: "github_token" }),
          ok: true,
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({ data: {} }),
        });

      await expect(
        fetchProjectStatus({
          accessToken: "access_token",
          issueNumbers: [1],
          owner: "owner",
          refreshToken: "refresh_token",
          repo: "repo",
        })
      ).rejects.toThrow("Repository not found");
    });

    it("상태가 없는 이슈에 대해 null 반환", async () => {
      const responseWithoutStatus = {
        data: {
          repository: {
            issue0: {
              number: 1,
              projectItems: {
                nodes: [],
              },
            },
          },
        },
      };

      (globalThis.fetch as jest.Mock)
        .mockResolvedValueOnce({
          json: async () => ({ access_token: "github_token" }),
          ok: true,
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify(responseWithoutStatus),
        });

      const result = await fetchProjectStatus({
        accessToken: "access_token",
        issueNumbers: [1],
        owner: "owner",
        refreshToken: "refresh_token",
        repo: "repo",
      });

      expect(result).toEqual([
        {
          color: null,
          number: 1,
          status: null,
        },
      ]);
    });

    it("여러 이슈 상태 조회", async () => {
      const multipleIssuesResponse = {
        data: {
          repository: {
            issue0: {
              number: 1,
              projectItems: {
                nodes: [
                  {
                    fieldValues: {
                      nodes: [
                        {
                          color: "GREEN",
                          field: { name: "Status" },
                          name: "Done",
                        },
                      ],
                    },
                  },
                ],
              },
            },
            issue1: {
              number: 2,
              projectItems: {
                nodes: [
                  {
                    fieldValues: {
                      nodes: [
                        {
                          color: "YELLOW",
                          field: { name: "Status" },
                          name: "In Progress",
                        },
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      };

      (globalThis.fetch as jest.Mock)
        .mockResolvedValueOnce({
          json: async () => ({ access_token: "github_token" }),
          ok: true,
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify(multipleIssuesResponse),
        });

      const result = await fetchProjectStatus({
        accessToken: "access_token",
        issueNumbers: [1, 2],
        owner: "owner",
        refreshToken: "refresh_token",
        repo: "repo",
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        color: "GREEN",
        number: 1,
        status: "Done",
      });
      expect(result[1]).toEqual({
        color: "YELLOW",
        number: 2,
        status: "In Progress",
      });
    });

    it("GitHub API 오류 시 에러 처리", async () => {
      (globalThis.fetch as jest.Mock)
        .mockResolvedValueOnce({
          json: async () => ({ access_token: "github_token" }),
          ok: true,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => "Internal Server Error",
        });

      await expect(
        fetchProjectStatus({
          accessToken: "access_token",
          issueNumbers: [1],
          owner: "owner",
          refreshToken: "refresh_token",
          repo: "repo",
        })
      ).rejects.toThrow("GitHub API error: 500");
    });

    it("토큰 갱신 외 다른 에러는 그대로 전파", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(
        fetchProjectStatus({
          accessToken: "access_token",
          issueNumbers: [1],
          owner: "owner",
          refreshToken: "refresh_token",
          repo: "repo",
        })
      ).rejects.toThrow("Token verification failed: 500");
    });
  });
});
