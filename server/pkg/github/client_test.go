package github

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestBuildProjectStatusQuery(t *testing.T) {
	tests := []struct {
		issueNumbers []int
		name         string
		wantContains []string
	}{
		{
			name:         "single issue",
			issueNumbers: []int{123},
			wantContains: []string{
				"issue0: issue(number: 123)",
				"projectItems(first: 10)",
				"fieldValues(first: 20)",
			},
		},
		{
			name:         "multiple issues",
			issueNumbers: []int{1, 2, 3},
			wantContains: []string{
				"issue0: issue(number: 1)",
				"issue1: issue(number: 2)",
				"issue2: issue(number: 3)",
			},
		},
		{
			name:         "empty array",
			issueNumbers: []int{},
			wantContains: []string{
				"query($owner: String!, $name: String!)",
				"repository(owner: $owner, name: $name)",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			query := buildProjectStatusQuery(tt.issueNumbers)

			for _, want := range tt.wantContains {
				if !strings.Contains(query, want) {
					t.Errorf("query should contain %q, got:\n%s", want, query)
				}
			}
		})
	}
}

func TestBuildUpdateStatusMutation(t *testing.T) {
	mutation := buildUpdateStatusMutation()

	wantContains := []string{
		"mutation($input: UpdateProjectV2ItemFieldValueInput!)",
		"updateProjectV2ItemFieldValue(input: $input)",
		"projectV2Item",
		"fieldValues(first: 20)",
	}

	for _, want := range wantContains {
		if !strings.Contains(mutation, want) {
			t.Errorf("mutation should contain %q, got:\n%s", want, mutation)
		}
	}
}

func TestFetchProjectStatus_Success(t *testing.T) {
	mockResponse := graphQLResponse{
		Data: &repositoryData{
			Repository: map[string]issueNode{
				"issue0": {
					Number: 1,
					ProjectItems: projectItems{
						Nodes: []projectItemNode{
							{
								ID: "item-123",
								Project: project{
									ID: "project-123",
								},
								FieldValues: fieldValues{
									Nodes: []fieldValueNode{
										{
											Name:  strPtr("Done"),
											Color: strPtr("GREEN"),
											Field: &fieldDetail{
												ID:   "field-123",
												Name: "Status",
												Options: []statusOption{
													{Color: "GREEN", ID: "opt-1", Name: "Done"},
													{Color: "YELLOW", ID: "opt-2", Name: "In Progress"},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-token" {
			t.Errorf("unexpected Authorization header: %s", r.Header.Get("Authorization"))
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mockResponse)
	}))
	defer server.Close()

	client := NewClientWithURL("test-token", server.URL)

	statuses, err := client.FetchProjectStatus(context.Background(), "owner", "repo", []int{1})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(statuses) != 1 {
		t.Fatalf("expected 1 status, got %d", len(statuses))
	}

	status := statuses[0]
	if status.Number != 1 {
		t.Errorf("expected number 1, got %d", status.Number)
	}
	if *status.Status != "Done" {
		t.Errorf("expected status Done, got %s", *status.Status)
	}
	if *status.Color != "GREEN" {
		t.Errorf("expected color GREEN, got %s", *status.Color)
	}
	if *status.ProjectID != "project-123" {
		t.Errorf("expected projectId project-123, got %s", *status.ProjectID)
	}
}

func TestFetchProjectStatus_GraphQLError(t *testing.T) {
	mockResponse := graphQLResponse{
		Errors: []graphQLError{
			{Message: "Not Found", Type: "NOT_FOUND"},
		},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mockResponse)
	}))
	defer server.Close()

	client := NewClientWithURL("test-token", server.URL)

	_, err := client.FetchProjectStatus(context.Background(), "owner", "repo", []int{1})
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	if !strings.Contains(err.Error(), "GraphQL error") {
		t.Errorf("expected GraphQL error, got: %v", err)
	}
}

func TestFetchProjectStatus_HTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte("Unauthorized"))
	}))
	defer server.Close()

	client := NewClientWithURL("invalid-token", server.URL)

	_, err := client.FetchProjectStatus(context.Background(), "owner", "repo", []int{1})
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	if !strings.Contains(err.Error(), "401") {
		t.Errorf("expected 401 error, got: %v", err)
	}
}

func TestFetchProjectStatus_NilRepository(t *testing.T) {
	mockResponse := graphQLResponse{
		Data: nil,
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mockResponse)
	}))
	defer server.Close()

	client := NewClientWithURL("test-token", server.URL)

	_, err := client.FetchProjectStatus(context.Background(), "owner", "repo", []int{1})
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	if !strings.Contains(err.Error(), "repository not found") {
		t.Errorf("expected repository not found error, got: %v", err)
	}
}

func TestFetchProjectStatus_IssueWithoutProject(t *testing.T) {
	mockResponse := graphQLResponse{
		Data: &repositoryData{
			Repository: map[string]issueNode{
				"issue0": {
					Number: 1,
					ProjectItems: projectItems{
						Nodes: []projectItemNode{},
					},
				},
			},
		},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mockResponse)
	}))
	defer server.Close()

	client := NewClientWithURL("test-token", server.URL)

	statuses, err := client.FetchProjectStatus(context.Background(), "owner", "repo", []int{1})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(statuses) != 1 {
		t.Fatalf("expected 1 status, got %d", len(statuses))
	}

	if statuses[0].Status != nil {
		t.Errorf("expected nil status, got %v", statuses[0].Status)
	}
}

func TestUpdateProjectStatus_Success(t *testing.T) {
	mockResponse := updateStatusResponse{
		Data: &updateData{
			UpdateProjectV2ItemFieldValue: &updateResult{
				ProjectV2Item: &projectV2Item{
					FieldValues: fieldValues{
						Nodes: []fieldValueNode{
							{
								Name:  strPtr("In Progress"),
								Color: strPtr("YELLOW"),
								Field: &fieldDetail{
									Name: "Status",
								},
							},
						},
					},
				},
			},
		},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mockResponse)
	}))
	defer server.Close()

	client := NewClientWithURL("test-token", server.URL)

	result, err := client.UpdateProjectStatus(context.Background(), "proj-1", "item-1", "field-1", "opt-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Status != "In Progress" {
		t.Errorf("expected status In Progress, got %s", result.Status)
	}
	if result.Color != "YELLOW" {
		t.Errorf("expected color YELLOW, got %s", result.Color)
	}
}

func TestUpdateProjectStatus_GraphQLError(t *testing.T) {
	mockResponse := updateStatusResponse{
		Errors: []graphQLError{
			{Message: "Insufficient permissions"},
		},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mockResponse)
	}))
	defer server.Close()

	client := NewClientWithURL("test-token", server.URL)

	_, err := client.UpdateProjectStatus(context.Background(), "proj-1", "item-1", "field-1", "opt-1")
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	if !strings.Contains(err.Error(), "GraphQL error") {
		t.Errorf("expected GraphQL error, got: %v", err)
	}
}

func TestUpdateProjectStatus_NoStatusFieldReturned(t *testing.T) {
	mockResponse := updateStatusResponse{
		Data: &updateData{
			UpdateProjectV2ItemFieldValue: &updateResult{
				ProjectV2Item: &projectV2Item{
					FieldValues: fieldValues{
						Nodes: []fieldValueNode{},
					},
				},
			},
		},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mockResponse)
	}))
	defer server.Close()

	client := NewClientWithURL("test-token", server.URL)

	_, err := client.UpdateProjectStatus(context.Background(), "proj-1", "item-1", "field-1", "opt-1")
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	if !strings.Contains(err.Error(), "failed to get updated status") {
		t.Errorf("expected failed to get updated status error, got: %v", err)
	}
}

func TestBuildIssueStatusList(t *testing.T) {
	repository := map[string]issueNode{
		"issue0": {
			Number: 1,
			ProjectItems: projectItems{
				Nodes: []projectItemNode{
					{
						ID:      "item-1",
						Project: project{ID: "proj-1"},
						FieldValues: fieldValues{
							Nodes: []fieldValueNode{
								{
									Name:  strPtr("Done"),
									Color: strPtr("GREEN"),
									Field: &fieldDetail{
										ID:   "field-1",
										Name: "Status",
										Options: []statusOption{
											{ID: "opt-1", Name: "Done", Color: "GREEN"},
										},
									},
								},
							},
						},
					},
				},
			},
		},
		"issue1": {
			Number:       2,
			ProjectItems: projectItems{Nodes: []projectItemNode{}},
		},
	}

	result := buildIssueStatusList(repository, []int{1, 2, 3})

	if len(result) != 3 {
		t.Fatalf("expected 3 results, got %d", len(result))
	}

	if result[0].Number != 1 {
		t.Errorf("expected number 1, got %d", result[0].Number)
	}
	if *result[0].Status != "Done" {
		t.Errorf("expected status Done, got %s", *result[0].Status)
	}

	if result[1].Number != 2 {
		t.Errorf("expected number 2, got %d", result[1].Number)
	}
	if result[1].Status != nil {
		t.Errorf("expected nil status for issue 2, got %v", result[1].Status)
	}

	if result[2].Number != 3 {
		t.Errorf("expected number 3, got %d", result[2].Number)
	}
	if result[2].Status != nil {
		t.Errorf("expected nil status for issue 3, got %v", result[2].Status)
	}
}

func TestNewClient(t *testing.T) {
	client := NewClient("test-token")

	if client.accessToken != "test-token" {
		t.Errorf("expected accessToken test-token, got %s", client.accessToken)
	}

	if client.graphQLURL != defaultGraphQLURL {
		t.Errorf("expected graphQLURL %s, got %s", defaultGraphQLURL, client.graphQLURL)
	}

	if client.httpClient == nil {
		t.Error("expected httpClient to be initialized")
	}
}

func TestNewClientWithURL(t *testing.T) {
	customURL := "https://custom.example.com/graphql"
	client := NewClientWithURL("test-token", customURL)

	if client.accessToken != "test-token" {
		t.Errorf("expected accessToken test-token, got %s", client.accessToken)
	}

	if client.graphQLURL != customURL {
		t.Errorf("expected graphQLURL %s, got %s", customURL, client.graphQLURL)
	}
}

func strPtr(s string) *string {
	return &s
}
