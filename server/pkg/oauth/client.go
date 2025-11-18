package oauth

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

const githubTokenURL = "https://github.com/login/oauth/access_token"

type Client struct {
	ClientID     string
	ClientSecret string
	HTTPClient   *http.Client
	TokenURL     string
}

var getClientFunc = sync.OnceValues(func() (*Client, error) {
	client, err := NewClient()
	if err != nil {
		slog.Warn("OAuth client initialization failed", "error", err)
	}
	return client, err
})

func GetClient() (*Client, error) {
	return getClientFunc()
}

func NewClient() (*Client, error) {
	clientID := os.Getenv("GITHUB_CLIENT_ID")
	clientSecret := os.Getenv("GITHUB_CLIENT_SECRET")

	if clientID == "" || clientSecret == "" {
		return nil, fmt.Errorf("OAuth configuration missing")
	}

	return &Client{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		HTTPClient:   &http.Client{Timeout: 10 * time.Second},
		TokenURL:     githubTokenURL,
	}, nil
}

func (c *Client) ExchangeCode(code string) (*TokenResponse, error) {
	data := url.Values{}
	data.Set("client_id", c.ClientID)
	data.Set("client_secret", c.ClientSecret)
	data.Set("code", code)

	return c.requestToken(data)
}

func (c *Client) RefreshToken(refreshToken string) (*TokenResponse, error) {
	data := url.Values{}
	data.Set("client_id", c.ClientID)
	data.Set("client_secret", c.ClientSecret)
	data.Set("grant_type", "refresh_token")
	data.Set("refresh_token", refreshToken)

	return c.requestToken(data)
}

func (c *Client) requestToken(data url.Values) (*TokenResponse, error) {
	tokenURL := c.TokenURL
	if tokenURL == "" {
		tokenURL = githubTokenURL
	}
	req, err := http.NewRequest(http.MethodPost, tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var tokenResp GitHubTokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if tokenResp.AccessToken == "" {
		var errResp GitHubErrorResponse
		if err := json.Unmarshal(body, &errResp); err == nil && errResp.Error != "" {
			return nil, fmt.Errorf("authentication failed: %s - %s", errResp.Error, errResp.ErrorDescription)
		}
		return nil, fmt.Errorf("authentication failed and could not parse error response from GitHub")
	}

	return &TokenResponse{
		AccessToken:  tokenResp.AccessToken,
		ExpiresIn:    tokenResp.ExpiresIn,
		RefreshToken: tokenResp.RefreshToken,
		TokenType:    tokenResp.TokenType,
	}, nil
}
