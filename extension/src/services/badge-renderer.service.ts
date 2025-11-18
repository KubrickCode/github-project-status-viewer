import { CSS_CLASSES, SELECTORS, UI_DEFAULTS } from "../constants/ui";
import { DisplayMode } from "../shared/types";

type ApplyUniformWidthParams = {
  maxWidth: number;
};

type CreateBadgeParams = {
  color: string | null;
  displayMode: DisplayMode;
  status: string;
};

type InsertBadgeParams = {
  color: string | null;
  displayMode: DisplayMode;
  issueNumber: number;
  status: string;
};

type UpdateBadgeDisplayParams = {
  badge: HTMLElement;
  displayMode: DisplayMode;
  status: string;
};

export const applyUniformWidth = ({ maxWidth }: ApplyUniformWidthParams): void => {
  if (maxWidth === 0) return;

  const badges = document.querySelectorAll<HTMLElement>(
    `.${CSS_CLASSES.BADGE}:not(.${CSS_CLASSES.BADGE_COMPACT})`
  );
  badges.forEach((badge) => {
    badge.style.minWidth = `${maxWidth}px`;
  });
};

export const calculateMaxBadgeWidth = (): number => {
  const badges = document.querySelectorAll<HTMLElement>(`.${CSS_CLASSES.BADGE}`);
  return Array.from(badges).reduce(
    (maxWidth, badge) => Math.max(maxWidth, badge.getBoundingClientRect().width),
    0
  );
};

export const createBadge = ({ color, displayMode, status }: CreateBadgeParams): HTMLElement => {
  const badge = document.createElement("span");
  badge.className = CSS_CLASSES.BADGE;
  badge.setAttribute("data-status", status);
  badge.style.setProperty("--status-color", color ?? UI_DEFAULTS.BADGE_COLOR);

  updateBadgeDisplay({ badge, displayMode, status });

  return badge;
};

export const insertBadge = ({
  color,
  displayMode,
  issueNumber,
  status,
}: InsertBadgeParams): boolean => {
  const issueLinks = document.querySelectorAll(SELECTORS.ISSUE_LINK);

  for (const link of issueLinks) {
    const href = link.getAttribute("href");
    if (!href?.includes(`/issues/${issueNumber}`)) continue;

    const h3Element = link.closest(SELECTORS.ISSUE_TITLE_CONTAINER);
    if (!h3Element) continue;

    const container = h3Element.parentElement;
    if (!container) continue;

    if (container.querySelector(`.${CSS_CLASSES.BADGE}`)) return false;

    const badge = createBadge({ color, displayMode, status });
    container.insertBefore(badge, h3Element);
    return true;
  }

  return false;
};

export const refreshAllBadgeDisplays = (displayMode: DisplayMode): void => {
  const badges = document.querySelectorAll<HTMLElement>(`.${CSS_CLASSES.BADGE}`);

  badges.forEach((badge) => {
    const statusText = badge.getAttribute("data-status");
    if (statusText) {
      updateBadgeDisplay({ badge, displayMode, status: statusText });
    }
  });
};

export const updateBadgeDisplay = ({
  badge,
  displayMode,
  status,
}: UpdateBadgeDisplayParams): void => {
  if (displayMode === "compact") {
    badge.classList.add(CSS_CLASSES.BADGE_COMPACT);
    badge.textContent = "";
    badge.title = status;
    badge.setAttribute("role", "img");
    badge.setAttribute("aria-label", `Status: ${status}`);
    badge.tabIndex = 0;
    badge.style.minWidth = "";
  } else {
    badge.classList.remove(CSS_CLASSES.BADGE_COMPACT);
    badge.textContent = status;
    badge.title = "";
    badge.removeAttribute("role");
    badge.removeAttribute("aria-label");
    badge.tabIndex = -1;
  }
};
