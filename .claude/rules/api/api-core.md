# API Core Standards

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

- Parameters: `?cursor=xyz&limit=20` (REST) or `first`, `after` (GraphQL)
- Response includes: data, next cursor, has next indicator

## Sorting

- Support sortBy and sortOrder parameters
- Support multiple sort criteria
- Specify defaults clearly

## Filtering

- Range: `{ min, max }` or `{ gte, lte }`
- Complex conditions use nested objects
