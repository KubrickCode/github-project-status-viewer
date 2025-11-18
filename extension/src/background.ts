import { ERROR_MESSAGES } from "./constants/api";
import { STORAGE_KEYS } from "./constants/storage";
import { fetchProjectStatus } from "./services/github-api.service";
import { MessageRequest, MessageResponse } from "./shared/types";

(() => {
  const handleMessage = async (
    request: MessageRequest,
    sendResponse: (response: MessageResponse) => void
  ) => {
    if (request.type !== "GET_PROJECT_STATUS") return false;

    try {
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
        sendResponse({ error: ERROR_MESSAGES.AUTH_REQUIRED });
        return true;
      }

      const statuses = await fetchProjectStatus({
        accessToken,
        issueNumbers: request.issueNumbers,
        owner: request.owner,
        refreshToken,
        repo: request.repo,
      });

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
