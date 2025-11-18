import { STORAGE_KEYS } from "./storage";

describe("Storage Constants", () => {
  describe("STORAGE_KEYS", () => {
    it("should have all required storage keys", () => {
      expect(STORAGE_KEYS.ACCESS_TOKEN).toBeDefined();
      expect(STORAGE_KEYS.DISPLAY_MODE).toBeDefined();
      expect(STORAGE_KEYS.OAUTH_STATE).toBeDefined();
      expect(STORAGE_KEYS.REFRESH_TOKEN).toBeDefined();
    });

    it("should have unique values for each key", () => {
      const values = Object.values(STORAGE_KEYS);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });

    it("should have valid identifier format for all values", () => {
      const validFormat = /^[a-zA-Z][a-zA-Z0-9_]*$/;
      Object.values(STORAGE_KEYS).forEach((value) => {
        expect(value).toMatch(validFormat);
      });
    });
  });
});
