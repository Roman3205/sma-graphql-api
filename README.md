# SMA GraphQL API

A GraphQL API built with **Apollo Server**, **Prisma ORM**, **Express 5**, and **PostgreSQL**.

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

### 3. Set up environment

Create a `.env` file and add variables.

### 4. Run migrations & generate Prisma client

```bash
npx prisma generate
```

### 5. Start the server

```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```

---

## Query Examples

### Get all posts (with cursor-based pagination)

```graphql
query GetPosts {
  posts(first: 10) {
    edges {
      cursor
      node {
        id
        title
        content
        published
        author {
          id
          name
          email
        }
      }
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    totalCount
  }
}
```

### Get a single post by ID

```graphql
query GetPost {
  post(id: "1") {
    id
    title
    content
    published
    author {
      id
      name
      email
    }
  }
}
```

### Get currently authenticated user profile

> **Header:** `Authorization: Bearer <token>`

```graphql
query GetMe {
  me {
    id
    name
    email
    createdAt
  }
}
```

### Get a single comment by ID and postId

```graphql
query GetComment {
  comment(postId: "1", id: "1") {
    id
    body
    createdAt
    author {
      name
    }
    post {
      title
    }
  }
}
```

### Get all comments by post ID

```graphql
query GetCommentsByPost {
  commentsByPost(postId: "1") {
    id
    body
    createdAt
    author {
      id
      name
    }
  }
}
```

### Get articles of authenticated user

> **Header:** `Authorization: Bearer <token>`

```graphql
query GetArticles {
  articles {
    id
    title
    content
    createdAt
    tags {
      id
      name
    }
  }
}
```

### Get a single article by ID

> **Header:** `Authorization: Bearer <token>`

```graphql
query GetArticle {
  article(id: "1") {
    id
    title
    content
    createdAt
    tags {
      id
      name
    }
  }
}
```

### Get all tags

> **Header:** `Authorization: Bearer <token>`

```graphql
query GetTags {
  tags {
    id
    name
  }
}
```

### Get all categories

```graphql
query GetCategories {
  categories {
    id
    name
  }
}
```

### Search posts, articles, and comments by text

> **Header:** `Authorization: Bearer <token>`

```graphql
query SearchContent {
  search(text: "GraphQL") {
    __typename
    ... on Post {
      id
      title
      content
    }
    ... on Article {
      id
      title
      content
    }
    ... on Comment {
      id
      body
    }
  }
}
```

### Get user dashboard details

> **Header:** `Authorization: Bearer <token>`

```graphql
query GetUserDashboard {
  userDashboard {
    user {
      id
      name
    }
    totalPosts
    totalComments
    totalArticles
    publishedPosts
    recentPosts {
      id
      title
    }
    recentComments {
      id
      body
    }
    recentArticles {
      id
      title
    }
    mostCommentedPost {
      id
      title
    }
  }
}
```

---

## Mutation Examples

### Sign up a new user (no auth required)

```graphql
mutation Signup {
  signup(
    data: {
      email: "john@example.com"
      name: "John Doe"
      password: "password123"
    }
  ) {
    token
    user {
      id
      name
      email
    }
  }
}
```

### Log in an existing user (no auth required)

```graphql
mutation Login {
  login(
    data: {
      email: "john@example.com"
      password: "password123"
    }
  ) {
    token
    user {
      id
      name
      email
    }
  }
}
```

### Create a draft post (auth required)

> **Header:** `Authorization: Bearer <token>`

```graphql
mutation CreateDraft {
  createDraft(
    data: {
      title: "New Article"
      content: "This is a draft article."
    }
  ) {
    id
    title
    content
    published
    author {
      id
      name
    }
  }
}
```

### Publish a post (auth required)

> **Header:** `Authorization: Bearer <token>`

```graphql
mutation PublishPost {
  publishPost(id: "1") {
    id
    title
    published
  }
}
```

### Delete a post (auth required)

> **Header:** `Authorization: Bearer <token>`

```graphql
mutation DeletePost {
  deletePost(id: "1") {
    id
    title
  }
}
```

### Create a comment on a post (auth required)

> **Header:** `Authorization: Bearer <token>`

```graphql
mutation CreateComment {
  createComment(
    data: {
      body: "Great post!"
      postId: 1
    }
  ) {
    id
    body
    createdAt
    post {
      id
      title
    }
  }
}
```

### Create a new article (auth required)

> **Header:** `Authorization: Bearer <token>`

```graphql
mutation CreateArticle {
  createArticle(
    data: {
      title: "Learning GraphQL"
      content: "Intro to GraphQL schemas and resolvers."
      tagIds: [1, 2]
    }
  ) {
    id
    title
    content
    createdAt
    tags {
      id
      name
    }
  }
}
```

### Add a category to a post (auth required)

> **Header:** `Authorization: Bearer <token>`

```graphql
mutation AddCategoryToPost {
  addCategoryToPost(postId: "1", categoryId: "1") {
    id
    title
    categories {
      id
      name
    }
  }
}
```

---

## Subscription Examples

### Subscribe to new posts creation

```graphql
subscription OnPostCreated {
  postCreated {
    id
    title
    content
    published
    author {
      id
      name
    }
  }
}
```