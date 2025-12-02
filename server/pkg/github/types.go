package github

type IssueStatus struct {
	Color         *string        `json:"color"`
	Number        int            `json:"number"`
	ProjectID     *string        `json:"projectId"`
	ProjectItemID *string        `json:"projectItemId"`
	Status        *string        `json:"status"`
	StatusFieldID *string        `json:"statusFieldId"`
	StatusOptions []StatusOption `json:"statusOptions"`
}

type StatusOption struct {
	Color string `json:"color"`
	ID    string `json:"id"`
	Name  string `json:"name"`
}

type UpdateStatusResult struct {
	Color  string `json:"color"`
	Status string `json:"status"`
}

type graphQLRequest struct {
	Query     string         `json:"query"`
	Variables map[string]any `json:"variables"`
}

type graphQLResponse struct {
	Data   *repositoryData `json:"data"`
	Errors []graphQLError  `json:"errors,omitempty"`
}

type graphQLError struct {
	Message string `json:"message"`
	Type    string `json:"type,omitempty"`
}

type repositoryData struct {
	Repository map[string]issueNode `json:"repository"`
}

type issueNode struct {
	Number       int          `json:"number"`
	ProjectItems projectItems `json:"projectItems"`
}

type projectItems struct {
	Nodes []projectItemNode `json:"nodes"`
}

type projectItemNode struct {
	FieldValues fieldValues `json:"fieldValues"`
	ID          string      `json:"id"`
	Project     project     `json:"project"`
}

type project struct {
	ID string `json:"id"`
}

type fieldValues struct {
	Nodes []fieldValueNode `json:"nodes"`
}

type fieldValueNode struct {
	Color *string      `json:"color,omitempty"`
	Field *fieldDetail `json:"field,omitempty"`
	Name  *string      `json:"name,omitempty"`
}

type fieldDetail struct {
	ID      string         `json:"id,omitempty"`
	Name    string         `json:"name"`
	Options []statusOption `json:"options,omitempty"`
}

type statusOption struct {
	Color string `json:"color"`
	ID    string `json:"id"`
	Name  string `json:"name"`
}

type updateStatusResponse struct {
	Data   *updateData    `json:"data"`
	Errors []graphQLError `json:"errors,omitempty"`
}

type updateData struct {
	UpdateProjectV2ItemFieldValue *updateResult `json:"updateProjectV2ItemFieldValue"`
}

type updateResult struct {
	ProjectV2Item *projectV2Item `json:"projectV2Item"`
}

type projectV2Item struct {
	FieldValues fieldValues `json:"fieldValues"`
}
