import { API } from "../constants/api";
import { STORAGE_KEYS } from "../constants/storage";
import { IssueStatus } from "../shared/types";

const HTTP_STATUS_UNAUTHORIZED = 401;

type FetchProjectStatusParams = {
  accessToken: string;
  issueNumbers: number[];
  owner: string;
  refreshToken: string;
  repo: string;
};

type RefreshResponse = {
  access_token: string;
  refresh_token: string;
};

type StatusResponse = {
  statuses: IssueStatus[];
};

type UpdateStatusParams = {
  accessToken: string;
  fieldId: string;
  itemId: string;
  optionId: string;
  projectId: string;
  refreshToken: string;
};

type UpdateStatusResponse = {
  color: string;
  status: string;
};

export const fetchProjectStatus = async ({
  accessToken,
  issueNumbers,
  owner,
  refreshToken,
  repo,
}: FetchProjectStatusParams): Promise<IssueStatus[]> => {
  const data = await withAuth<StatusResponse>({
    accessToken,
    body: { issueNumbers, owner, repo },
    refreshToken,
    url: `${API.BASE_URL}/issues/status`,
  });
  return data.statuses;
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

  const data = await withAuth<UpdateStatusResponse>({
    accessToken,
    body: { fieldId, itemId, optionId, projectId },
    refreshToken,
    url: `${API.BASE_URL}/issues/status/update`,
  });
  return {
    color: data.color,
    status: data.status,
  };
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

type WithAuthParams = {
  accessToken: string;
  body: object;
  refreshToken: string;
  url: string;
};

const withAuth = async <T>({
  accessToken,
  body,
  refreshToken,
  url,
}: WithAuthParams): Promise<T> => {
  const makeRequest = async (token: string) => {
    return fetch(url, {
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  };

  let response = await makeRequest(accessToken);

  if (response.status === HTTP_STATUS_UNAUTHORIZED) {
    const tokens = await refreshTokens(refreshToken);
    await chrome.storage.session.set({
      [STORAGE_KEYS.ACCESS_TOKEN]: tokens.accessToken,
      [STORAGE_KEYS.REFRESH_TOKEN]: tokens.refreshToken,
    });
    response = await makeRequest(tokens.accessToken);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error: ${response.status} - ${errorText}`);
  }

  return response.json() as Promise<T>;
};
