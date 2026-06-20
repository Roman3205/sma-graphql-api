# GraphQL Prisma API

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

Create a `.env` file:

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

### Query Examples

#### Get all published posts

```graphql
query GetPosts {
  posts {
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

#### Get a single post by ID

```graphql
query GetPost {
  post(id: 1) {
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

---

### Mutation Examples

#### Create a user (no auth required)

```graphql
mutation CreateUser {
  createUser(
    data: {
      email: "john@example.com"
      name: "John Doe"
      posts: [
        { title: "My First Post", content: "Hello World!", published: true }
        { title: "Draft Post", content: "Work in progress" }
      ]
    }
  ) {
    id
    name
    email
    posts {
      id
      title
      published
    }
  }
}
```

#### Create a user without initial posts

```graphql
mutation CreateUser {
  createUser(
    data: {
      email: "jane@example.com"
      name: "Jane Doe"
      posts: []
    }
  ) {
    id
    name
    email
  }
}
```

#### Create a draft post (auth required)

> **Header:** `Authorization: any-token`

```graphql
mutation CreateDraft {
  createDraft(
    data: {
      title: "New Article"
      content: "This is a draft article."
      authorId: 1
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

#### Create a draft post without an author (auth required)

> **Header:** `Authorization: any-token`

```graphql
mutation CreateDraft {
  createDraft(
    data: {
      title: "Anonymous Post"
      content: "No author assigned."
    }
  ) {
    id
    title
    published
  }
}
```

#### Publish a post (auth required)

> **Header:** `Authorization: any-token`

```graphql
mutation PublishPost {
  publishPost(id: 1) {
    id
    title
    published
  }
}
```