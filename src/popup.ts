(() => {
  type Config = {
    pat: string;
  };

  const STORAGE_KEYS = ["pat"] as const;
  const STATUS_DISPLAY_DURATION = 3000;

  const showStatus = (
    statusDiv: HTMLDivElement,
    message: string,
    type: "success" | "error"
  ) => {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = "block";

    setTimeout(() => {
      statusDiv.style.display = "none";
    }, STATUS_DISPLAY_DURATION);
  };

  const loadSavedConfig = async (patInput: HTMLInputElement) => {
    const result = await chrome.storage.sync.get(STORAGE_KEYS);

    if (result.pat) patInput.value = result.pat;
  };

  const saveConfig = async (pat: string, statusDiv: HTMLDivElement) => {
    if (!pat) {
      showStatus(statusDiv, "Please enter your GitHub token", "error");
      return;
    }

    const config: Config = { pat };

    try {
      await chrome.storage.sync.set(config);
      console.log("[Popup] Saved config:", {
        hasPat: !!pat,
        patLength: pat.length,
      });

      const saved = await chrome.storage.sync.get(["pat"]);
      console.log("[Popup] Verified saved config:", {
        hasPat: !!saved.pat,
        patLength: saved.pat?.length,
      });

      showStatus(statusDiv, "Configuration saved successfully!", "success");
    } catch (error) {
      showStatus(statusDiv, "Failed to save configuration", "error");
      console.error("[Popup] Save error:", error);
    }
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const patInput = document.getElementById("pat") as HTMLInputElement;
    const saveButton = document.getElementById("save") as HTMLButtonElement;
    const statusDiv = document.getElementById("status") as HTMLDivElement;

    await loadSavedConfig(patInput);

    saveButton.addEventListener("click", async () => {
      const pat = patInput.value.trim();
      await saveConfig(pat, statusDiv);
    });
  });
})();
