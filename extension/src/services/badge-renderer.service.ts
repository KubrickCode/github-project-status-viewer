import { CSS_CLASSES, SELECTORS, UI_DEFAULTS } from "../constants/ui";
import { DisplayMode, StatusOption } from "../shared/types";

type ApplyUniformWidthParams = {
  maxWidth: number;
};

type BadgeClickHandler = (params: {
  badge: HTMLElement;
  currentStatus: string;
  issueNumber: number;
  projectId: string;
  projectItemId: string;
  statusFieldId: string;
  statusOptions: StatusOption[];
}) => void;

type CreateBadgeParams = {
  color: string | null;
  displayMode: DisplayMode;
  issueNumber: number;
  onBadgeClick?: BadgeClickHandler;
  projectId: string | null;
  projectItemId: string | null;
  status: string;
  statusFieldId: string | null;
  statusOptions: StatusOption[] | null;
};

type InsertBadgeParams = {
  color: string | null;
  displayMode: DisplayMode;
  issueNumber: number;
  onBadgeClick?: BadgeClickHandler;
  projectId: string | null;
  projectItemId: string | null;
  status: string;
  statusFieldId: string | null;
  statusOptions: StatusOption[] | null;
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

export const createBadge = ({
  color,
  displayMode,
  issueNumber,
  onBadgeClick,
  projectId,
  projectItemId,
  status,
  statusFieldId,
  statusOptions,
}: CreateBadgeParams): HTMLElement => {
  const badge = document.createElement("span");
  badge.className = CSS_CLASSES.BADGE;
  badge.setAttribute("data-status", status);
  badge.setAttribute("data-issue-number", issueNumber.toString());
  badge.style.setProperty("--status-color", color ?? UI_DEFAULTS.BADGE_COLOR);

  const isClickable =
    onBadgeClick && projectId && projectItemId && statusFieldId && statusOptions?.length;

  if (isClickable) {
    badge.classList.add("project-status-badge--clickable");
    badge.setAttribute("role", "button");
    badge.setAttribute("aria-haspopup", "listbox");
    badge.tabIndex = 0;

    const triggerBadgeClick = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      onBadgeClick({
        badge,
        currentStatus: status,
        issueNumber,
        projectId,
        projectItemId,
        statusFieldId,
        statusOptions,
      });
    };

    badge.addEventListener("click", triggerBadgeClick);
    badge.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        triggerBadgeClick(e);
      }
    });
  }

  updateBadgeDisplay({ badge, displayMode, status });

  return badge;
};

export const insertBadge = ({
  color,
  displayMode,
  issueNumber,
  onBadgeClick,
  projectId,
  projectItemId,
  status,
  statusFieldId,
  statusOptions,
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

    const badge = createBadge({
      color,
      displayMode,
      issueNumber,
      onBadgeClick,
      projectId,
      projectItemId,
      status,
      statusFieldId,
      statusOptions,
    });
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
  const isClickable = badge.classList.contains("project-status-badge--clickable");

  if (displayMode === "compact") {
    badge.classList.add(CSS_CLASSES.BADGE_COMPACT);
    badge.textContent = "";
    badge.title = status;
    if (!isClickable) {
      badge.setAttribute("role", "img");
      badge.setAttribute("aria-label", `Status: ${status}`);
    }
    badge.tabIndex = 0;
    badge.style.minWidth = "";
  } else {
    badge.classList.remove(CSS_CLASSES.BADGE_COMPACT);
    badge.textContent = status;
    badge.title = "";
    if (!isClickable) {
      badge.removeAttribute("role");
      badge.removeAttribute("aria-label");
      badge.tabIndex = -1;
    }
  }
};

export const updateBadgeStatus = ({
  issueNumber,
  newColor,
  newStatus,
}: {
  issueNumber: number;
  newColor: string | null;
  newStatus: string;
}): void => {
  const badge = document.querySelector<HTMLElement>(
    `.${CSS_CLASSES.BADGE}[data-issue-number="${issueNumber}"]`
  );

  if (!badge) return;

  badge.setAttribute("data-status", newStatus);
  badge.style.setProperty("--status-color", newColor || UI_DEFAULTS.BADGE_COLOR);

  const isCompact = badge.classList.contains(CSS_CLASSES.BADGE_COMPACT);
  if (isCompact) {
    badge.title = newStatus;
    badge.setAttribute("aria-label", `Status: ${newStatus}`);
  } else {
    badge.textContent = newStatus;
  }
};
