(() => {
  type AuthConfig = {
    jwtToken: string;
  };

  type CallbackResponse = {
    token: string;
  };

  const API_BASE_URL = "https://github-project-status-viewer.vercel.app/api";
  const GITHUB_CLIENT_ID = "Ov23liFFkeCk13ofhM7c";
  const GITHUB_OAUTH_URL = "https://github.com/login/oauth/authorize";
  const OAUTH_SCOPE_STRING = "repo read:project";
  const STATUS_DISPLAY_DURATION = 3000;
  const STORAGE_KEY = "jwtToken";

  const generateState = (): string => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
      ""
    );
  };

  const showStatus = (
    statusDiv: HTMLDivElement,
    message: string,
    type: "error" | "info" | "success"
  ) => {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = "block";

    setTimeout(() => {
      statusDiv.style.display = "none";
    }, STATUS_DISPLAY_DURATION);
  };

  const checkAuthStatus = async (): Promise<boolean> => {
    const result = await chrome.storage.session.get([STORAGE_KEY]);
    return !!result.jwtToken;
  };

  const updateUI = async () => {
    const isLoggedIn = await checkAuthStatus();
    const loginSection = document.getElementById("loginSection");
    const loggedInSection = document.getElementById("loggedInSection");

    if (isLoggedIn) {
      loginSection?.classList.remove("active");
      loggedInSection?.classList.add("active");
    } else {
      loginSection?.classList.add("active");
      loggedInSection?.classList.remove("active");
    }
  };

  const handleLogin = async (statusDiv: HTMLDivElement) => {
    const state = generateState();
    const redirectUri = chrome.identity.getRedirectURL();

    await chrome.storage.session.set({ oauthState: state });

    const authUrl = `${GITHUB_OAUTH_URL}?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=${OAUTH_SCOPE_STRING}&state=${state}`;

    try {
      showStatus(statusDiv, "Opening GitHub login...", "info");

      const redirectUrl = await chrome.identity.launchWebAuthFlow({
        interactive: true,
        url: authUrl,
      });

      if (!redirectUrl) {
        showStatus(statusDiv, "Login cancelled", "error");
        return;
      }

      const url = new URL(redirectUrl);
      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");

      if (!code || !returnedState) {
        showStatus(statusDiv, "Invalid OAuth response", "error");
        return;
      }

      const { oauthState } = await chrome.storage.session.get(["oauthState"]);

      if (returnedState !== oauthState) {
        showStatus(statusDiv, "Invalid state parameter (CSRF)", "error");
        return;
      }

      await chrome.storage.session.remove(["oauthState"]);

      const callbackUrl = `${API_BASE_URL}/callback?code=${code}&state=${returnedState}`;
      const response = await fetch(callbackUrl);

      if (!response.ok) {
        throw new Error(`Callback failed: ${response.status}`);
      }

      const data: CallbackResponse = await response.json();

      const config: AuthConfig = { jwtToken: data.token };
      await chrome.storage.session.set(config);

      showStatus(statusDiv, "Login successful!", "success");
      await updateUI();
    } catch (error) {
      showStatus(
        statusDiv,
        error instanceof Error ? error.message : "Login failed",
        "error"
      );
    }
  };

  const handleLogout = async (statusDiv: HTMLDivElement) => {
    try {
      await chrome.storage.session.remove([STORAGE_KEY]);
      showStatus(statusDiv, "Logged out successfully", "success");
      await updateUI();
    } catch (error) {
      showStatus(statusDiv, "Logout failed", "error");
    }
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const loginBtn = document.getElementById("loginBtn") as HTMLButtonElement;
    const logoutBtn = document.getElementById("logoutBtn") as HTMLButtonElement;
    const statusDiv = document.getElementById("status") as HTMLDivElement;

    await updateUI();

    loginBtn?.addEventListener("click", async () => {
      await handleLogin(statusDiv);
    });

    logoutBtn?.addEventListener("click", async () => {
      await handleLogout(statusDiv);
    });
  });
})();
