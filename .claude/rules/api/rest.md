# REST API Standards

## Pagination

### Cursor-Based

- Parameters: `?cursor=xyz&limit=20`
- Response: `{ data: [...], nextCursor: "abc", hasNext: true }`

## Sorting

- `?sortBy=createdAt&sortOrder=desc`

## URL Structure

### Nested Resources

- Maximum 2 levels

### Actions

- Allow verbs only when unable to represent as resource
- `/users/:id/activate`

## Response

### List

- `data` + pagination info

### Creation

- 201 + resource (excluding sensitive information)

### Error (RFC 7807 ProblemDetail)

- Required: `type`, `title`, `status`, `detail`, `instance`
- Optional: `errors` array

## Batch

- `/batch` suffix
- Success/failure count + results
