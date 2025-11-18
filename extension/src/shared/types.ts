export type DisplayMode = "compact" | "full";

export type StatusType = "error" | "info" | "success";

export type IssueStatus = {
  color: string | null;
  number: number;
  status: string | null;
};

export type MessageRequest = {
  issueNumbers: number[];
  owner: string;
  repo: string;
  type: "GET_PROJECT_STATUS";
};

export type MessageResponse = {
  error?: string;
  statuses?: IssueStatus[];
};
