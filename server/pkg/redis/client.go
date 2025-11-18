package redis

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"sync"
	"time"
)

const (
	RefreshTokenKeyPrefix = "refresh_token:"
	RefreshTokenTTL       = 30 * 24 * time.Hour
	SessionKeyPrefix      = "session:"
	SessionTTL            = 30 * 24 * time.Hour
	defaultTimeout        = 10 * time.Second
)

var ErrKeyNotFound = errors.New("key not found")

type Client struct {
	baseURL string
	token   string
	client  *http.Client
}

type upstashResponse struct {
	Result any    `json:"result"`
	Error  string `json:"error,omitempty"`
}

var getClientFunc = sync.OnceValues(func() (*Client, error) {
	client, err := NewClient()
	if err != nil {
		slog.Warn("Redis client initialization failed", "error", err)
	}
	return client, err
})

func GetClient() (*Client, error) {
	return getClientFunc()
}

func NewClient() (*Client, error) {
	baseURL := os.Getenv("KV_REST_API_URL")
	token := os.Getenv("KV_REST_API_TOKEN")

	if baseURL == "" || token == "" {
		return nil, fmt.Errorf("upstash redis configuration missing")
	}

	return &Client{
		baseURL: baseURL,
		token:   token,
		client:  &http.Client{Timeout: defaultTimeout},
	}, nil
}

func (c *Client) Set(key string, value string, expiration time.Duration) error {
	cmd := []any{"SET", key, value}
	if expiration > 0 {
		cmd = append(cmd, "EX", int(expiration.Seconds()))
	}

	_, err := c.execute(cmd)
	return err
}

func (c *Client) Get(key string) (string, error) {
	result, err := c.execute([]any{"GET", key})
	if err != nil {
		return "", err
	}

	if result == nil {
		return "", ErrKeyNotFound
	}

	str, ok := result.(string)
	if !ok {
		return "", fmt.Errorf("unexpected response type")
	}

	return str, nil
}

func (c *Client) Delete(key string) error {
	_, err := c.execute([]any{"DEL", key})
	return err
}

func (c *Client) Exists(key string) (bool, error) {
	result, err := c.execute([]any{"EXISTS", key})
	if err != nil {
		return false, err
	}

	count, ok := result.(float64)
	if !ok {
		return false, fmt.Errorf("unexpected response type")
	}

	return count > 0, nil
}

func (c *Client) execute(cmd []any) (any, error) {
	body, err := json.Marshal(cmd)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal command: %w", err)
	}

	req, err := http.NewRequest("POST", c.baseURL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("redis request failed with status %d (failed to read error body: %w)", resp.StatusCode, err)
		}
		return nil, fmt.Errorf("redis request failed with status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var response upstashResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if response.Error != "" {
		return nil, fmt.Errorf("redis error: %s", response.Error)
	}

	return response.Result, nil
}
