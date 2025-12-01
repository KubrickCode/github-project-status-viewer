import { ERROR_MESSAGES } from "./constants/api";
import { STORAGE_KEYS } from "./constants/storage";
import { fetchProjectStatus, updateProjectStatus } from "./services/github-api.service";
import {
  GetProjectStatusRequest,
  MessageResponse,
  UpdateProjectStatusRequest,
} from "./shared/types";

(() => {
  const getTokens = async (): Promise<{
    accessToken: string;
    refreshToken: string;
  } | null> => {
    const result = await chrome.storage.session.get([
      STORAGE_KEYS.ACCESS_TOKEN,
      STORAGE_KEYS.REFRESH_TOKEN,
    ]);

    const accessToken = result[STORAGE_KEYS.ACCESS_TOKEN];
    const refreshToken = result[STORAGE_KEYS.REFRESH_TOKEN];

    if (
      typeof accessToken !== "string" ||
      !accessToken ||
      typeof refreshToken !== "string" ||
      !refreshToken
    ) {
      return null;
    }

    return { accessToken, refreshToken };
  };

  const isValidGetProjectStatusRequest = (request: unknown): request is GetProjectStatusRequest => {
    if (typeof request !== "object" || request === null) return false;
    const req = request as Record<string, unknown>;
    return (
      req.type === "GET_PROJECT_STATUS" &&
      typeof req.owner === "string" &&
      typeof req.repo === "string" &&
      Array.isArray(req.issueNumbers) &&
      req.issueNumbers.every((n) => typeof n === "number")
    );
  };

  const isValidUpdateProjectStatusRequest = (
    request: unknown
  ): request is UpdateProjectStatusRequest => {
    if (typeof request !== "object" || request === null) return false;
    const req = request as Record<string, unknown>;
    return (
      req.type === "UPDATE_PROJECT_STATUS" &&
      typeof req.owner === "string" &&
      typeof req.repo === "string" &&
      typeof req.issueNumber === "number" &&
      typeof req.projectId === "string" &&
      typeof req.itemId === "string" &&
      typeof req.fieldId === "string" &&
      typeof req.optionId === "string"
    );
  };

  const handleGetProjectStatus = async (
    request: GetProjectStatusRequest,
    sendResponse: (response: MessageResponse) => void
  ) => {
    try {
      const tokens = await getTokens();
      if (!tokens) {
        sendResponse({ error: ERROR_MESSAGES.AUTH_REQUIRED });
        return;
      }

      const statuses = await fetchProjectStatus({
        accessToken: tokens.accessToken,
        issueNumbers: request.issueNumbers,
        owner: request.owner,
        refreshToken: tokens.refreshToken,
        repo: request.repo,
      });

      sendResponse({ statuses });
    } catch (error) {
      sendResponse({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleUpdateProjectStatus = async (
    request: UpdateProjectStatusRequest,
    sendResponse: (response: MessageResponse) => void
  ) => {
    try {
      const tokens = await getTokens();
      if (!tokens) {
        sendResponse({ error: ERROR_MESSAGES.AUTH_REQUIRED });
        return;
      }

      const updatedStatus = await updateProjectStatus({
        accessToken: tokens.accessToken,
        fieldId: request.fieldId,
        itemId: request.itemId,
        optionId: request.optionId,
        projectId: request.projectId,
        refreshToken: tokens.refreshToken,
      });

      sendResponse({ success: true, updatedStatus });
    } catch (error) {
      sendResponse({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  chrome.runtime.onMessage.addListener((request: unknown, _sender, sendResponse) => {
    if (isValidGetProjectStatusRequest(request)) {
      handleGetProjectStatus(request, sendResponse);
      return true;
    }

    if (isValidUpdateProjectStatusRequest(request)) {
      handleUpdateProjectStatus(request, sendResponse);
      return true;
    }

    return false;
  });
})();
