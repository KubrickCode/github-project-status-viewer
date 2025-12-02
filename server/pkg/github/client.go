package github

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	defaultGraphQLURL = "https://api.github.com/graphql"
	defaultTimeout    = 30 * time.Second
	issueAliasPrefix  = "issue"
	projectItemsLimit = 10
	fieldValuesLimit  = 20
	statusFieldName   = "Status"
)

type Client struct {
	accessToken string
	graphQLURL  string
	httpClient  *http.Client
}

func NewClient(accessToken string) *Client {
	return &Client{
		accessToken: accessToken,
		graphQLURL:  defaultGraphQLURL,
		httpClient:  &http.Client{Timeout: defaultTimeout},
	}
}

func NewClientWithURL(accessToken, graphQLURL string) *Client {
	return &Client{
		accessToken: accessToken,
		graphQLURL:  graphQLURL,
		httpClient:  &http.Client{Timeout: defaultTimeout},
	}
}

func (c *Client) FetchProjectStatus(ctx context.Context, owner, repo string, issueNumbers []int) ([]IssueStatus, error) {
	query := buildProjectStatusQuery(issueNumbers)

	reqBody := graphQLRequest{
		Query: query,
		Variables: map[string]any{
			"owner": owner,
			"name":  repo,
		},
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.graphQLURL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.accessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API error: %d - %s", resp.StatusCode, string(respBody))
	}

	var gqlResp graphQLResponse
	if err := json.Unmarshal(respBody, &gqlResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if len(gqlResp.Errors) > 0 {
		return nil, fmt.Errorf("GraphQL error: %s", gqlResp.Errors[0].Message)
	}

	if gqlResp.Data == nil {
		return nil, fmt.Errorf("repository not found")
	}

	return buildIssueStatusList(gqlResp.Data.Repository, issueNumbers), nil
}

func (c *Client) UpdateProjectStatus(ctx context.Context, projectID, itemID, fieldID, optionID string) (*UpdateStatusResult, error) {
	query := buildUpdateStatusMutation()

	reqBody := graphQLRequest{
		Query: query,
		Variables: map[string]any{
			"input": map[string]any{
				"projectId": projectID,
				"itemId":    itemID,
				"fieldId":   fieldID,
				"value": map[string]any{
					"singleSelectOptionId": optionID,
				},
			},
		},
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.graphQLURL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.accessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API error: %d - %s", resp.StatusCode, string(respBody))
	}

	var gqlResp updateStatusResponse
	if err := json.Unmarshal(respBody, &gqlResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if len(gqlResp.Errors) > 0 {
		return nil, fmt.Errorf("GraphQL error: %s", gqlResp.Errors[0].Message)
	}

	if gqlResp.Data == nil || gqlResp.Data.UpdateProjectV2ItemFieldValue == nil {
		return nil, fmt.Errorf("failed to update status")
	}

	fieldValues := gqlResp.Data.UpdateProjectV2ItemFieldValue.ProjectV2Item.FieldValues.Nodes
	for _, node := range fieldValues {
		if node.Field != nil && node.Field.Name == statusFieldName && node.Name != nil {
			color := ""
			if node.Color != nil {
				color = *node.Color
			}
			return &UpdateStatusResult{
				Color:  color,
				Status: *node.Name,
			}, nil
		}
	}

	return nil, fmt.Errorf("failed to get updated status")
}

func buildProjectStatusQuery(issueNumbers []int) string {
	var issueQueries strings.Builder

	for i, num := range issueNumbers {
		fmt.Fprintf(&issueQueries, `
		%s%d: issue(number: %d) {
			number
			projectItems(first: %d) {
				nodes {
					id
					project {
						id
					}
					fieldValues(first: %d) {
						nodes {
							... on ProjectV2ItemFieldSingleSelectValue {
								name
								color
								field {
									... on ProjectV2SingleSelectField {
										id
										name
										options {
											id
											name
											color
										}
									}
								}
							}
						}
					}
				}
			}
		}`, issueAliasPrefix, i, num, projectItemsLimit, fieldValuesLimit)
	}

	return fmt.Sprintf(`
		query($owner: String!, $name: String!) {
			repository(owner: $owner, name: $name) {
				%s
			}
		}
	`, issueQueries.String())
}

func buildUpdateStatusMutation() string {
	return fmt.Sprintf(`
		mutation($input: UpdateProjectV2ItemFieldValueInput!) {
			updateProjectV2ItemFieldValue(input: $input) {
				projectV2Item {
					fieldValues(first: %d) {
						nodes {
							... on ProjectV2ItemFieldSingleSelectValue {
								name
								color
								field {
									... on ProjectV2SingleSelectField {
										name
									}
								}
							}
						}
					}
				}
			}
		}
	`, fieldValuesLimit)
}

type issueStatusData struct {
	color         *string
	projectID     *string
	projectItemID *string
	status        *string
	statusFieldID *string
	statusOptions []StatusOption
}

func findStatusField(item projectItemNode) *issueStatusData {
	for _, node := range item.FieldValues.Nodes {
		if node.Field == nil || node.Field.Name != statusFieldName || node.Name == nil {
			continue
		}

		var options []StatusOption
		if node.Field.Options != nil {
			options = make([]StatusOption, len(node.Field.Options))
			for i, opt := range node.Field.Options {
				options[i] = StatusOption{
					Color: opt.Color,
					ID:    opt.ID,
					Name:  opt.Name,
				}
			}
		}

		projectID := item.Project.ID
		itemID := item.ID
		fieldID := node.Field.ID

		return &issueStatusData{
			color:         node.Color,
			projectID:     &projectID,
			projectItemID: &itemID,
			status:        node.Name,
			statusFieldID: &fieldID,
			statusOptions: options,
		}
	}

	return nil
}

func buildIssueStatusList(repository map[string]issueNode, issueNumbers []int) []IssueStatus {
	statusMap := make(map[int]*issueStatusData)

	for key, issue := range repository {
		if !strings.HasPrefix(key, issueAliasPrefix) {
			continue
		}

		if issue.Number == 0 || len(issue.ProjectItems.Nodes) == 0 {
			continue
		}

		firstProjectItem := issue.ProjectItems.Nodes[0]
		statusData := findStatusField(firstProjectItem)
		if statusData != nil {
			statusMap[issue.Number] = statusData
		}
	}

	result := make([]IssueStatus, len(issueNumbers))
	for i, num := range issueNumbers {
		result[i] = IssueStatus{Number: num}

		if data, ok := statusMap[num]; ok {
			result[i].Color = data.color
			result[i].ProjectID = data.projectID
			result[i].ProjectItemID = data.projectItemID
			result[i].Status = data.status
			result[i].StatusFieldID = data.statusFieldID
			result[i].StatusOptions = data.statusOptions
		}
	}

	return result
}
