import { API } from "../constants/api";
import { STORAGE_KEYS } from "../constants/storage";
import { fetchProjectStatus, refreshTokens, updateProjectStatus } from "./github-api.service";

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

const createMockResponse = (options: {
  json?: () => Promise<unknown>;
  ok: boolean;
  status?: number;
  text?: () => Promise<string>;
}) => ({
  json: options.json ?? (async () => ({})),
  ok: options.ok,
  status: options.status ?? (options.ok ? 200 : 500),
  text: options.text ?? (async () => ""),
});

describe("github-api.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("refreshTokens", () => {
    it("리프레시 토큰으로 새 토큰 획득", async () => {
      const mockTokens = {
        access_token: "new_access_token",
        refresh_token: "new_refresh_token",
      };
      (globalThis.fetch as jest.Mock).mockResolvedValueOnce(
        createMockResponse({
          json: async () => mockTokens,
          ok: true,
        })
      );

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
      (globalThis.fetch as jest.Mock).mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 401,
        })
      );

      await expect(refreshTokens("invalid_refresh_token")).rejects.toThrow(
        "Token refresh failed: 401"
      );
    });
  });

  describe("fetchProjectStatus", () => {
    const mockStatusResponse = {
      statuses: [
        {
          color: "GREEN",
          number: 1,
          projectId: "project-123",
          projectItemId: "item-123",
          status: "Done",
          statusFieldId: "field-123",
          statusOptions: [
            { color: "GREEN", id: "opt-1", name: "Done" },
            { color: "YELLOW", id: "opt-2", name: "In Progress" },
          ],
        },
      ],
    };

    it("프로젝트 상태 조회 성공", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValueOnce(
        createMockResponse({
          json: async () => mockStatusResponse,
          ok: true,
        })
      );

      const result = await fetchProjectStatus({
        accessToken: "access_token",
        issueNumbers: [1],
        owner: "owner",
        refreshToken: "refresh_token",
        repo: "repo",
      });

      expect(result).toEqual(mockStatusResponse.statuses);
      expect(globalThis.fetch).toHaveBeenCalledWith(`${API.BASE_URL}/issues/status`, {
        body: JSON.stringify({
          issueNumbers: [1],
          owner: "owner",
          repo: "repo",
        }),
        headers: {
          Authorization: "Bearer access_token",
          "Content-Type": "application/json",
        },
        method: "POST",
      });
    });

    it("토큰 만료 시 갱신 후 재시도", async () => {
      (globalThis.fetch as jest.Mock)
        .mockResolvedValueOnce(createMockResponse({ ok: false, status: 401 }))
        .mockResolvedValueOnce(
          createMockResponse({
            json: async () => ({
              access_token: "new_access_token",
              refresh_token: "new_refresh_token",
            }),
            ok: true,
          })
        )
        .mockResolvedValueOnce(
          createMockResponse({
            json: async () => mockStatusResponse,
            ok: true,
          })
        );

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
      expect(result).toEqual(mockStatusResponse.statuses);
    });

    it("API 에러 시 에러 발생", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 500,
          text: async () => "Internal Server Error",
        })
      );

      await expect(
        fetchProjectStatus({
          accessToken: "access_token",
          issueNumbers: [1],
          owner: "owner",
          refreshToken: "refresh_token",
          repo: "repo",
        })
      ).rejects.toThrow("API error: 500");
    });
  });

  describe("updateProjectStatus", () => {
    const mockUpdateResponse = {
      color: "GREEN",
      status: "Done",
    };

    it("상태 업데이트 성공", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValueOnce(
        createMockResponse({
          json: async () => mockUpdateResponse,
          ok: true,
        })
      );

      const result = await updateProjectStatus({
        accessToken: "access_token",
        fieldId: "field-123",
        itemId: "item-123",
        optionId: "opt-1",
        projectId: "project-123",
        refreshToken: "refresh_token",
      });

      expect(result).toEqual(mockUpdateResponse);
      expect(globalThis.fetch).toHaveBeenCalledWith(`${API.BASE_URL}/issues/status/update`, {
        body: JSON.stringify({
          fieldId: "field-123",
          itemId: "item-123",
          optionId: "opt-1",
          projectId: "project-123",
        }),
        headers: {
          Authorization: "Bearer access_token",
          "Content-Type": "application/json",
        },
        method: "POST",
      });
    });

    it("필수 파라미터 누락 시 에러 발생", async () => {
      await expect(
        updateProjectStatus({
          accessToken: "access_token",
          fieldId: "",
          itemId: "item-123",
          optionId: "opt-1",
          projectId: "project-123",
          refreshToken: "refresh_token",
        })
      ).rejects.toThrow("Missing required parameters for updateProjectStatus");
    });

    it("토큰 만료 시 갱신 후 재시도", async () => {
      (globalThis.fetch as jest.Mock)
        .mockResolvedValueOnce(createMockResponse({ ok: false, status: 401 }))
        .mockResolvedValueOnce(
          createMockResponse({
            json: async () => ({
              access_token: "new_access_token",
              refresh_token: "new_refresh_token",
            }),
            ok: true,
          })
        )
        .mockResolvedValueOnce(
          createMockResponse({
            json: async () => mockUpdateResponse,
            ok: true,
          })
        );

      const result = await updateProjectStatus({
        accessToken: "expired_token",
        fieldId: "field-123",
        itemId: "item-123",
        optionId: "opt-1",
        projectId: "project-123",
        refreshToken: "refresh_token",
      });

      expect(mockChromeStorage.session.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.ACCESS_TOKEN]: "new_access_token",
        [STORAGE_KEYS.REFRESH_TOKEN]: "new_refresh_token",
      });
      expect(result.status).toBe("Done");
    });

    it("API 에러 시 에러 발생", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 500,
          text: async () => "Internal Server Error",
        })
      );

      await expect(
        updateProjectStatus({
          accessToken: "access_token",
          fieldId: "field-123",
          itemId: "item-123",
          optionId: "opt-1",
          projectId: "project-123",
          refreshToken: "refresh_token",
        })
      ).rejects.toThrow("API error: 500");
    });
  });
});
