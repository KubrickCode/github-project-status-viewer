export type DisplayMode = "compact" | "full";

export type StatusType = "error" | "info" | "success";

export type IssueStatus = {
  color: string | null;
  number: number;
  projectId: string | null;
  projectItemId: string | null;
  status: string | null;
  statusFieldId: string | null;
  statusOptions: StatusOption[] | null;
};

export type StatusOption = {
  color: string;
  id: string;
  name: string;
};

export type ProjectInfo = {
  fieldId: string;
  itemId: string;
  options: StatusOption[];
  projectId: string;
};

export type GetProjectStatusRequest = {
  issueNumbers: number[];
  owner: string;
  repo: string;
  type: "GET_PROJECT_STATUS";
};

export type UpdateProjectStatusRequest = {
  fieldId: string;
  issueNumber: number;
  itemId: string;
  optionId: string;
  owner: string;
  projectId: string;
  repo: string;
  type: "UPDATE_PROJECT_STATUS";
};

export type MessageRequest = GetProjectStatusRequest | UpdateProjectStatusRequest;

export type MessageResponse = {
  error?: string;
  statuses?: IssueStatus[];
  success?: boolean;
  updatedStatus?: {
    color: string;
    status: string;
  };
};
