---
name: rest-api
description: |
  Standard guide for REST API design and implementation. URL structure, pagination, sorting, filtering, error handling standardized patterns.
  TRIGGER: REST API design, endpoint definition, RESTful principle application, HTTP status code decision, response structure design
---

# REST API Design Standards

## Naming Conventions

### Field Naming

- Boolean: Require `is/has/can` prefix
- Date: Require `~At` suffix
- Use consistent terminology throughout the project (unify on either "create" or "add")

## Date Format

- ISO 8601 UTC
- Use DateTime type

## Pagination

### Cursor-Based (Industry Standard)

- Parameters: `?cursor=xyz&limit=20`
- Response: `{ data: [...], nextCursor: "abc", hasNext: true }`

## Sorting

- `?sortBy=createdAt&sortOrder=desc`
- Support multiple sort
- Specify defaults

## Filtering

- Range: `{ min, max }` or `{ gte, lte }`
- Complex conditions use nested objects

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
