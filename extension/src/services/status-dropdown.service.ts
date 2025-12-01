import { UI_DEFAULTS } from "../constants/ui";
import { StatusOption } from "../shared/types";

const DROPDOWN_CLASS = "project-status-dropdown";
const DROPDOWN_ITEM_CLASS = "project-status-dropdown__item";
const DROPDOWN_LOADING_CLASS = "project-status-dropdown--loading";

const GITHUB_STATUS_COLORS: Record<string, string> = {
  BLUE: "#0969da",
  GRAY: "#6e7781",
  GREEN: "#1a7f37",
  ORANGE: "#bc4c00",
  PINK: "#bf3989",
  PURPLE: "#8250df",
  RED: "#cf222e",
  YELLOW: "#9a6700",
};

type CreateDropdownParams = {
  currentStatus: string;
  onSelect: (option: StatusOption) => void;
  options: StatusOption[];
};

type ShowDropdownParams = {
  anchor: HTMLElement;
  currentStatus: string;
  onSelect: (option: StatusOption) => void;
  options: StatusOption[];
};

let activeDropdown: HTMLElement | null = null;
let cleanupListener: (() => void) | null = null;
let outsideClickTimerId: ReturnType<typeof setTimeout> | null = null;

export const closeDropdown = (): void => {
  if (outsideClickTimerId !== null) {
    clearTimeout(outsideClickTimerId);
    outsideClickTimerId = null;
  }
  if (activeDropdown) {
    activeDropdown.remove();
    activeDropdown = null;
  }
  if (cleanupListener) {
    cleanupListener();
    cleanupListener = null;
  }
};

export const showDropdown = ({
  anchor,
  currentStatus,
  onSelect,
  options,
}: ShowDropdownParams): void => {
  closeDropdown();

  const dropdown = createDropdown({ currentStatus, onSelect, options });
  document.body.appendChild(dropdown);
  activeDropdown = dropdown;

  positionDropdown(dropdown, anchor);
  setupOutsideClickHandler(dropdown, anchor);
  setupKeyboardNavigation(dropdown);
};

export const setDropdownLoading = (loading: boolean): void => {
  if (!activeDropdown) return;

  if (loading) {
    activeDropdown.classList.add(DROPDOWN_LOADING_CLASS);
    activeDropdown.querySelectorAll("button").forEach((btn) => {
      btn.disabled = true;
    });
  } else {
    activeDropdown.classList.remove(DROPDOWN_LOADING_CLASS);
    activeDropdown.querySelectorAll("button").forEach((btn) => {
      btn.disabled = false;
    });
  }
};

const createDropdown = ({
  currentStatus,
  onSelect,
  options,
}: CreateDropdownParams): HTMLElement => {
  const dropdown = document.createElement("div");
  dropdown.className = DROPDOWN_CLASS;
  dropdown.setAttribute("role", "listbox");
  dropdown.setAttribute("aria-label", "Select status");

  options.forEach((option, index) => {
    const item = document.createElement("button");
    item.className = DROPDOWN_ITEM_CLASS;
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", (option.name === currentStatus).toString());
    item.setAttribute("data-index", index.toString());

    const colorDot = document.createElement("span");
    colorDot.className = "project-status-dropdown__color";
    colorDot.style.backgroundColor = getColorValue(option.color);

    const label = document.createElement("span");
    label.className = "project-status-dropdown__label";
    label.textContent = option.name;

    item.appendChild(colorDot);
    item.appendChild(label);

    if (option.name === currentStatus) {
      item.classList.add("project-status-dropdown__item--selected");
    }

    item.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onSelect(option);
    });

    dropdown.appendChild(item);
  });

  return dropdown;
};

const getColorValue = (color: string): string => {
  return GITHUB_STATUS_COLORS[color.toUpperCase()] || UI_DEFAULTS.BADGE_COLOR;
};

const positionDropdown = (dropdown: HTMLElement, anchor: HTMLElement): void => {
  const anchorRect = anchor.getBoundingClientRect();
  const scrollTop = window.scrollY;
  const scrollLeft = window.scrollX;

  dropdown.style.position = "absolute";
  dropdown.style.top = `${anchorRect.bottom + scrollTop + 4}px`;
  dropdown.style.left = `${anchorRect.left + scrollLeft}px`;

  requestAnimationFrame(() => {
    const dropdownRect = dropdown.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (dropdownRect.right > viewportWidth) {
      dropdown.style.left = `${anchorRect.right + scrollLeft - dropdownRect.width}px`;
    }

    if (dropdownRect.bottom > viewportHeight) {
      dropdown.style.top = `${anchorRect.top + scrollTop - dropdownRect.height - 4}px`;
    }
  });
};

const setupKeyboardNavigation = (dropdown: HTMLElement): void => {
  const items = dropdown.querySelectorAll<HTMLButtonElement>("button");
  let focusedIndex = -1;

  const focusItem = (index: number) => {
    if (index >= 0 && index < items.length) {
      items[index].focus();
      focusedIndex = index;
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusItem(focusedIndex < items.length - 1 ? focusedIndex + 1 : 0);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusItem(focusedIndex > 0 ? focusedIndex - 1 : items.length - 1);
        break;
      case "Escape":
        e.preventDefault();
        closeDropdown();
        break;
      case "Tab":
        e.preventDefault();
        closeDropdown();
        break;
    }
  };

  dropdown.addEventListener("keydown", handleKeyDown);
  focusItem(0);
};

const setupOutsideClickHandler = (dropdown: HTMLElement, anchor: HTMLElement): void => {
  const handleClick = (e: MouseEvent) => {
    const target = e.target as Node;
    if (!dropdown.contains(target) && !anchor.contains(target)) {
      closeDropdown();
    }
  };

  outsideClickTimerId = setTimeout(() => {
    outsideClickTimerId = null;
    document.addEventListener("click", handleClick);
  }, 0);

  cleanupListener = () => {
    document.removeEventListener("click", handleClick);
  };
};
