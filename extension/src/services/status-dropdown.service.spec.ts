import { vi } from "vitest";

import { closeDropdown, setDropdownLoading, showDropdown } from "./status-dropdown.service";

const DROPDOWN_CLASS = "project-status-dropdown";
const DROPDOWN_ITEM_CLASS = "project-status-dropdown__item";
const DROPDOWN_LOADING_CLASS = "project-status-dropdown--loading";

const createMockOptions = () => [
  { color: "GREEN", id: "opt-1", name: "Done" },
  { color: "YELLOW", id: "opt-2", name: "In Progress" },
  { color: "GRAY", id: "opt-3", name: "Todo" },
];

const createAnchorElement = (): HTMLElement => {
  const anchor = document.createElement("span");
  anchor.className = "project-status-badge";
  anchor.style.position = "absolute";
  anchor.style.top = "100px";
  anchor.style.left = "100px";
  anchor.style.width = "80px";
  anchor.style.height = "24px";
  document.body.appendChild(anchor);
  return anchor;
};

describe("status-dropdown.service", () => {
  let anchor: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    anchor = createAnchorElement();
  });

  afterEach(() => {
    closeDropdown();
    document.body.innerHTML = "";
  });

  describe("showDropdown", () => {
    it("should create and display dropdown", () => {
      const onSelect = vi.fn();

      showDropdown({
        anchor,
        currentStatus: "Todo",
        onSelect,
        options: createMockOptions(),
      });

      const dropdown = document.querySelector(`.${DROPDOWN_CLASS}`);
      expect(dropdown).not.toBeNull();
      expect(dropdown?.getAttribute("role")).toBe("listbox");
    });

    it("should render all status options", () => {
      const options = createMockOptions();
      const onSelect = vi.fn();

      showDropdown({
        anchor,
        currentStatus: "Todo",
        onSelect,
        options,
      });

      const items = document.querySelectorAll(`.${DROPDOWN_ITEM_CLASS}`);
      expect(items.length).toBe(options.length);
    });

    it("should mark current status as selected", () => {
      const onSelect = vi.fn();

      showDropdown({
        anchor,
        currentStatus: "In Progress",
        onSelect,
        options: createMockOptions(),
      });

      const selectedItem = document.querySelector(`.${DROPDOWN_ITEM_CLASS}[aria-selected="true"]`);
      expect(selectedItem).not.toBeNull();
      expect(selectedItem?.textContent).toContain("In Progress");
    });

    it("should close existing dropdown before opening new one", () => {
      const onSelect = vi.fn();

      showDropdown({
        anchor,
        currentStatus: "Todo",
        onSelect,
        options: createMockOptions(),
      });

      showDropdown({
        anchor,
        currentStatus: "Done",
        onSelect,
        options: createMockOptions(),
      });

      const dropdowns = document.querySelectorAll(`.${DROPDOWN_CLASS}`);
      expect(dropdowns.length).toBe(1);
    });

    it("should call onSelect when option is clicked", () => {
      const onSelect = vi.fn();
      const options = createMockOptions();

      showDropdown({
        anchor,
        currentStatus: "Todo",
        onSelect,
        options,
      });

      const firstItem = document.querySelector(`.${DROPDOWN_ITEM_CLASS}`) as HTMLButtonElement;
      firstItem.click();

      expect(onSelect).toHaveBeenCalledWith(options[0]);
    });

    it("should position dropdown below anchor", () => {
      const onSelect = vi.fn();

      showDropdown({
        anchor,
        currentStatus: "Todo",
        onSelect,
        options: createMockOptions(),
      });

      const dropdown = document.querySelector(`.${DROPDOWN_CLASS}`) as HTMLElement;
      expect(dropdown.style.position).toBe("absolute");
    });
  });

  describe("closeDropdown", () => {
    it("should remove dropdown from DOM", () => {
      const onSelect = vi.fn();

      showDropdown({
        anchor,
        currentStatus: "Todo",
        onSelect,
        options: createMockOptions(),
      });

      expect(document.querySelector(`.${DROPDOWN_CLASS}`)).not.toBeNull();

      closeDropdown();

      expect(document.querySelector(`.${DROPDOWN_CLASS}`)).toBeNull();
    });

    it("should do nothing if no dropdown is active", () => {
      expect(() => closeDropdown()).not.toThrow();
    });
  });

  describe("setDropdownLoading", () => {
    it("should add loading class and disable buttons", () => {
      const onSelect = vi.fn();

      showDropdown({
        anchor,
        currentStatus: "Todo",
        onSelect,
        options: createMockOptions(),
      });

      setDropdownLoading(true);

      const dropdown = document.querySelector(`.${DROPDOWN_CLASS}`);
      expect(dropdown?.classList.contains(DROPDOWN_LOADING_CLASS)).toBe(true);

      const buttons = document.querySelectorAll(`.${DROPDOWN_ITEM_CLASS}`);
      buttons.forEach((btn) => {
        expect((btn as HTMLButtonElement).disabled).toBe(true);
      });
    });

    it("should remove loading class and enable buttons", () => {
      const onSelect = vi.fn();

      showDropdown({
        anchor,
        currentStatus: "Todo",
        onSelect,
        options: createMockOptions(),
      });

      setDropdownLoading(true);
      setDropdownLoading(false);

      const dropdown = document.querySelector(`.${DROPDOWN_CLASS}`);
      expect(dropdown?.classList.contains(DROPDOWN_LOADING_CLASS)).toBe(false);

      const buttons = document.querySelectorAll(`.${DROPDOWN_ITEM_CLASS}`);
      buttons.forEach((btn) => {
        expect((btn as HTMLButtonElement).disabled).toBe(false);
      });
    });

    it("should do nothing if no dropdown is active", () => {
      expect(() => setDropdownLoading(true)).not.toThrow();
    });
  });

  describe("keyboard navigation", () => {
    it("should close dropdown on Escape key", () => {
      const onSelect = vi.fn();

      showDropdown({
        anchor,
        currentStatus: "Todo",
        onSelect,
        options: createMockOptions(),
      });

      const dropdown = document.querySelector(`.${DROPDOWN_CLASS}`) as HTMLElement;
      const escapeEvent = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
      dropdown.dispatchEvent(escapeEvent);

      expect(document.querySelector(`.${DROPDOWN_CLASS}`)).toBeNull();
    });

    it("should close dropdown on Tab key", () => {
      const onSelect = vi.fn();

      showDropdown({
        anchor,
        currentStatus: "Todo",
        onSelect,
        options: createMockOptions(),
      });

      const dropdown = document.querySelector(`.${DROPDOWN_CLASS}`) as HTMLElement;
      const tabEvent = new KeyboardEvent("keydown", { key: "Tab", bubbles: true });
      dropdown.dispatchEvent(tabEvent);

      expect(document.querySelector(`.${DROPDOWN_CLASS}`)).toBeNull();
    });

    it("should navigate with ArrowDown key", () => {
      const onSelect = vi.fn();

      showDropdown({
        anchor,
        currentStatus: "Todo",
        onSelect,
        options: createMockOptions(),
      });

      const dropdown = document.querySelector(`.${DROPDOWN_CLASS}`) as HTMLElement;
      const items = document.querySelectorAll(`.${DROPDOWN_ITEM_CLASS}`);

      const arrowDownEvent = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true });
      dropdown.dispatchEvent(arrowDownEvent);

      expect(document.activeElement).toBe(items[1]);
    });

    it("should navigate with ArrowUp key", () => {
      const onSelect = vi.fn();

      showDropdown({
        anchor,
        currentStatus: "Todo",
        onSelect,
        options: createMockOptions(),
      });

      const dropdown = document.querySelector(`.${DROPDOWN_CLASS}`) as HTMLElement;
      const items = document.querySelectorAll(`.${DROPDOWN_ITEM_CLASS}`);

      const arrowUpEvent = new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true });
      dropdown.dispatchEvent(arrowUpEvent);

      expect(document.activeElement).toBe(items[items.length - 1]);
    });
  });

  describe("outside click handling", () => {
    it("should close dropdown when clicking outside", async () => {
      const onSelect = vi.fn();

      showDropdown({
        anchor,
        currentStatus: "Todo",
        onSelect,
        options: createMockOptions(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      document.body.click();

      expect(document.querySelector(`.${DROPDOWN_CLASS}`)).toBeNull();
    });

    it("should not close dropdown when clicking inside", async () => {
      const onSelect = vi.fn();

      showDropdown({
        anchor,
        currentStatus: "Todo",
        onSelect,
        options: createMockOptions(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const dropdown = document.querySelector(`.${DROPDOWN_CLASS}`) as HTMLElement;
      dropdown.click();

      expect(document.querySelector(`.${DROPDOWN_CLASS}`)).not.toBeNull();
    });
  });

  describe("color mapping", () => {
    it("should apply correct color to option dots", () => {
      const onSelect = vi.fn();

      showDropdown({
        anchor,
        currentStatus: "Todo",
        onSelect,
        options: [{ color: "GREEN", id: "opt-1", name: "Done" }],
      });

      const colorDot = document.querySelector(".project-status-dropdown__color") as HTMLElement;
      expect(colorDot.style.backgroundColor).toBe("rgb(26, 127, 55)");
    });

    it("should use default color for unknown color names", () => {
      const onSelect = vi.fn();

      showDropdown({
        anchor,
        currentStatus: "Todo",
        onSelect,
        options: [{ color: "UNKNOWN_COLOR", id: "opt-1", name: "Custom" }],
      });

      const colorDot = document.querySelector(".project-status-dropdown__color") as HTMLElement;
      expect(colorDot.style.backgroundColor).toBe("rgb(110, 119, 129)");
    });
  });
});
