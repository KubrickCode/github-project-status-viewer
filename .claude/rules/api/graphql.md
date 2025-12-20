# GraphQL API Standards

## Pagination

### Relay Connection Specification

```graphql
type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
}

type UserEdge {
  node: User!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  endCursor: String
}
```

- Parameters: `first`, `after`

## Sorting

- `orderBy: [{ field: "createdAt", order: DESC }]`

## Type Naming

- Input: `{Verb}{Type}Input`
- Connection: `{Type}Connection`
- Edge: `{Type}Edge`

## Input

- Separate creation and modification (required for creation, optional for modification)
- Avoid nesting - IDs only

## Errors

### extensions (default)

- `code`, `field` in `errors[].extensions`

### Union (type safety)

- `User | ValidationError`

## N+1

- DataLoader is mandatory

## Documentation

- `"""description"""` is required
- Explicitly state Input constraints

## Deprecation

- `@deprecated(reason: "...")`
- Never delete types
