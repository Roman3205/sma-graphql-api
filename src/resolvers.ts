import { GraphQLError, GraphQLResolveInfo, Kind } from "graphql"
import { prisma } from "./lib/prisma"
import { requestContext } from "./server"
import { PostCreateInput, CommentCreateInput, ArticleCreateInput, SignupInput, LoginInput } from "./types"
import { pubsub, POST_CREATED } from "./lib/pubsub"
import { generateToken, hashPassword, comparePasswords } from "./utils/auth"

function getRequestedTypes(info: GraphQLResolveInfo): Set<string> {
    const types = new Set<string>()
    for (const fieldNode of info.fieldNodes) {
        for (const selection of fieldNode.selectionSet?.selections || []) {
            if (selection.kind === Kind.INLINE_FRAGMENT && selection.typeCondition) {
                types.add(selection.typeCondition.name.value)
            }
        }
    }
    return types
}

const searchResultTypes = ['Comment', 'Post', 'Article'] as const

type SearchResultType = typeof searchResultTypes[number]

function requireAuth(context: requestContext): number {
    if (!context.userId) {
        throw new GraphQLError("You must be logged in", {
            extensions: { code: "UNAUTHENTICATED", http: { status: 401 } },
        })
    }
    return context.userId
}

function encodeCursor(id: number): string {
    return Buffer.from(`cursor:${id}`).toString("base64")
}

function decodeCursor(cursor: string): number {
    const decoded = Buffer.from(cursor, "base64").toString("utf-8")
    const id = parseInt(decoded.replace("cursor:", ""), 10)
    if (isNaN(id)) {
        throw new GraphQLError("Invalid cursor", {
            extensions: { code: "BAD_USER_INPUT" },
        })
    }
    return id
}

const resolvers = {
    Query: {
        posts: async (
            _: unknown,
            args: { first?: number; after?: string; last?: number; before?: string },
        ) => {
            const take = args.first || args.last || 10
            const isBackward = !!args.last

            let cursorObj: { id: number } | undefined
            let orderBy: any = { id: "asc" }

            if (args.after) {
                cursorObj = { id: decodeCursor(args.after) }
                orderBy = { id: "asc" }
            } else if (args.before) {
                cursorObj = { id: decodeCursor(args.before) }
                orderBy = { id: "desc" }
            }

            if (isBackward) {
                orderBy = { id: "desc" }
            }

            const posts = await prisma.post.findMany({
                take: take + 1,
                ...(cursorObj && {
                    cursor: cursorObj,
                    skip: 1,
                }),
                orderBy,
            })

            if (isBackward || args.before) {
                posts.reverse()
            }

            const hasExtra = posts.length > take
            if (hasExtra) posts.pop()

            const edges = posts.map((post) => ({
                cursor: encodeCursor(post.id),
                node: post,
            }))

            const totalCount = await prisma.post.count()

            return {
                edges,
                pageInfo: {
                    hasNextPage: args.before ? true : hasExtra,
                    hasPreviousPage: args.after ? true : (isBackward ? hasExtra : false),
                    startCursor: edges.length > 0 ? edges[0].cursor : null,
                    endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
                },
                totalCount,
            }
        },

        post: async (_: unknown, args: { id: string }) => {
            const post = await prisma.post.findUnique({
                where: { id: Number(args.id) },
            })
            return post
        },

        me: async (_: unknown, __: unknown, context: requestContext) => {
            const userId = requireAuth(context)
            return prisma.user.findUnique({ where: { id: userId } })
        },

        comment: async (_: unknown, args: { postId: string, id: string }) => {
            const comment = await prisma.comment.findFirst({
                where: {
                    id:  Number(args.id),
                    postId: Number(args.postId)
                }
            })

            if (!comment) {
                throw new GraphQLError("Comment not found", {
                    extensions: { code: "NOT_FOUND", http: { status: 404 } },
                })
            }
            
            return comment
        },

        commentsByPost: async (_: unknown, args: { postId: string }) => {
            const post = await prisma.post.findUnique({ where: { id: Number(args.postId) } })
            if (!post) {
                throw new GraphQLError("Post not found", {
                    extensions: { code: "NOT_FOUND", http: { status: 404 } },
                })
            }
            return prisma.comment.findMany({ where: { postId: post.id } })
        },

        articles: (_: unknown, __: unknown, context: requestContext) => {
            const userId = requireAuth(context)
            return prisma.article.findMany({ where: { authorId: userId } })
        },

        article: async (_: unknown, args: { id: string }, context: requestContext) => {
            const userId = requireAuth(context)
            const article = await prisma.article.findUnique({ where: { id: Number(args.id), authorId: userId } })
            if (!article) {
                throw new GraphQLError("Article not found", {
                    extensions: { code: "NOT_FOUND", http: { status: 404 } },
                })
            }
            return article
        },

        tags: (_: unknown, __: unknown, context: requestContext) => {
            requireAuth(context)
            return prisma.tag.findMany()
        },

        categories: () => {
            return prisma.category.findMany()
        },

        search: async (
            _: unknown,
            args: { text: string },
            context: requestContext,
            info: GraphQLResolveInfo
        ) => {
            const userId = requireAuth(context)
            const term = args.text
            const requestedTypes = getRequestedTypes(info)

            const results: any[] = []
            const queries: Promise<void>[] = []

            if (requestedTypes.has("Post")) {
                queries.push(
                    prisma.post.findMany({
                        where: {
                            OR: [
                                { title: { contains: term, mode: "insensitive" } },
                                { content: { contains: term, mode: "insensitive" } },
                            ],
                        },
                    }).then((posts) => {
                        results.push(...posts.map((p) => ({ ...p, __typename: "Post" as const })))
                    })
                )
            }

            if (requestedTypes.has("Article")) {
                queries.push(
                    prisma.article.findMany({
                        where: {
                            OR: [
                                { title: { contains: term, mode: "insensitive" } },
                                { content: { contains: term, mode: "insensitive" } },
                            ],
                        },
                    }).then((articles) => {
                        results.push(...articles.map((a) => ({ ...a, __typename: "Article" as const })))
                    })
                )
            }

            if (requestedTypes.has("Comment")) {
                queries.push(
                    prisma.comment.findMany({
                        where: {
                            body: { contains: term, mode: "insensitive" },
                        },
                    }).then((comments) => {
                        results.push(...comments.map((c) => ({ ...c, __typename: "Comment" as const })))
                    })
                )
            }

            await Promise.all(queries)
            return results
        },

        userDashboard: async (_: unknown, __: unknown, context: requestContext) => {
            const userId = requireAuth(context)

            const user = await prisma.user.findUnique({ where: { id: userId } })

            if (!user) {
                throw new GraphQLError("User not found", {
                    extensions: { code: "NOT_FOUND", http: { status: 404 } },
                })
            }

            const [
                totalPosts,
                totalComments,
                totalArticles,
                publishedPosts,
                recentPosts,
                recentComments,
                recentArticles,
                mostCommentedPostResult,
            ] = await Promise.all([
                prisma.post.count({ where: { authorId: userId } }),
                prisma.comment.count({ where: { authorId: userId } }),
                prisma.article.count({ where: { authorId: userId } }),
                prisma.post.count({ where: { authorId: userId, published: true } }),
                prisma.post.findMany({
                    where: { authorId: userId },
                    orderBy: { createdAt: "desc" },
                    take: 5,
                }),
                prisma.comment.findMany({
                    where: { authorId: userId },
                    orderBy: { createdAt: "desc" },
                    take: 5,
                }),
                prisma.article.findMany({
                    where: { authorId: userId },
                    orderBy: { createdAt: "desc" },
                    take: 5,
                }),
                prisma.post.findMany({
                    where: { authorId: userId },
                    include: { _count: { select: { comments: true } } },
                    orderBy: { comments: { _count: "desc" } },
                    take: 1,
                }),
            ])

            return {
                user,
                totalPosts,
                totalComments,
                totalArticles,
                publishedPosts,
                recentPosts,
                recentComments,
                recentArticles,
                mostCommentedPost: mostCommentedPostResult[0] || null,
            }
        },
    },

    Mutation: {
        signup: async (_: unknown, args: SignupInput) => {
            const { email, name, password } = args.data

            if (password.length < 6) {
                throw new GraphQLError("Password must be at least 6 characters", {
                    extensions: { code: "BAD_USER_INPUT" },
                })
            }

            const existing = await prisma.user.findUnique({ where: { email } })
            if (existing) {
                throw new GraphQLError("Email already in use", {
                    extensions: { code: "BAD_USER_INPUT" },
                })
            }

            const hashedPassword = await hashPassword(password)

            const user = await prisma.user.create({
                data: { email, name, password: hashedPassword },
            })

            return { token: generateToken(user.id), user }
        },

        login: async (_: unknown, args: LoginInput) => {
            const { email, password } = args.data

            const user = await prisma.user.findUnique({ where: { email } })
            if (!user) {
                throw new GraphQLError("Invalid email or password", {
                    extensions: { code: "UNAUTHENTICATED" },
                })
            }

            const valid = await comparePasswords(password, user.password)
            if (!valid) {
                throw new GraphQLError("Invalid email or password", {
                    extensions: { code: "UNAUTHENTICATED" },
                })
            }

            return { token: generateToken(user.id), user }
        },

        createDraft: async (_: unknown, args: PostCreateInput, context: requestContext) => {
            const userId = requireAuth(context)

            const post = await prisma.post.create({
                data: {
                    content: args.data.content,
                    title: args.data.title,
                    author: { connect: { id: userId } },
                },
            })

            pubsub.publish(POST_CREATED, { postCreated: post })
            return post
        },

        publishPost: async (_: unknown, args: { id: string }, context: requestContext) => {
            const userId = requireAuth(context)
            const post = await prisma.post.findUnique({ where: { id: Number(args.id), authorId: userId } })

            if (!post) {
                throw new GraphQLError("Post not found", {
                    extensions: { code: "NOT_FOUND", http: { status: 404 } },
                })
            }

            return prisma.post.update({
                where: { id: post.id },
                data: { published: true },
            })
        },

        deletePost: async (_: unknown, args: { id: string }, context: requestContext) => {
            const userId = requireAuth(context)
            const post = await prisma.post.findUnique({ where: { id: Number(args.id), authorId: userId } })

            if (!post) {
                throw new GraphQLError("Post not found", {
                    extensions: { code: "NOT_FOUND", http: { status: 404 } },
                })
            }

            return prisma.post.delete({ where: { id: post.id } })
        },

        createComment: async (_: unknown, args: CommentCreateInput, context: requestContext) => {
            const userId = requireAuth(context)

            const post = await prisma.post.findUnique({ where: { id: args.data.postId } })
            if (!post) {
                throw new GraphQLError("Post not found", {
                    extensions: { code: "NOT_FOUND", http: { status: 404 } },
                })
            }

            return prisma.comment.create({
                data: {
                    body: args.data.body,
                    post: { connect: { id: args.data.postId } },
                    author: { connect: { id: userId } },
                },
            })
        },

        createArticle: (_: unknown, args: ArticleCreateInput, context: requestContext) => {
            const userId = requireAuth(context)

            return prisma.article.create({
                data: {
                    title: args.data.title,
                    content: args.data.content,
                    author: { connect: { id: userId } },
                    ...(args.data.tagIds && {
                        tags: {
                            connect: args.data.tagIds.map((id) => ({ id })),
                        },
                    }),
                },
            })
        },

        addCategoryToPost: async (
            _: unknown,
            args: { postId: string; categoryId: string },
            context: requestContext
        ) => {
            const userId = requireAuth(context)
            const post = await prisma.post.findUnique({ where: { id: Number(args.postId), authorId: userId } })

            if (!post) {
                throw new GraphQLError("Post not found", {
                    extensions: { code: "NOT_FOUND", http: { status: 404 } },
                })
            }

            return prisma.post.update({
                where: { id: post.id },
                data: { categories: { connect: { id: Number(args.categoryId) } } },
            })
        },
    },

    Subscription: {
        postCreated: {
            subscribe: () => pubsub.asyncIterator(POST_CREATED),
        },
    },

    User: {
        posts: (parent: { id: number }) => {
            return prisma.post.findMany({ where: { authorId: parent.id } })
        },
        comments: (parent: { id: number }) => {
            return prisma.comment.findMany({ where: { authorId: parent.id } })
        },
        articles: (parent: { id: number }) => {
            return prisma.article.findMany({ where: { authorId: parent.id } })
        },
    },

    Post: {
        author: (parent: { authorId: number | null }, _args: unknown, context: requestContext) => {
            if (!parent.authorId) return null
            return context.loaders.userLoader.load(parent.authorId)
        },
        comments: (parent: { id: number }, _args: unknown, context: requestContext) => {
            return context.loaders.commentsByPostLoader.load(parent.id)
        },
        categories: (parent: { id: number }, _args: unknown, context: requestContext) => {
            return context.loaders.categoriesByPostLoader.load(parent.id)
        },
    },

    Comment: {
        author: (parent: { authorId: number }, _args: unknown, context: requestContext) => {
            return context.loaders.userLoader.load(parent.authorId)
        },
        post: (parent: { postId: number }, _args: unknown, context: requestContext) => {
            return context.loaders.postLoader.load(parent.postId)
        },
    },

    Article: {
        author: (parent: { authorId: number }, _args: unknown, context: requestContext) => {
            return context.loaders.userLoader.load(parent.authorId)
        },
        tags: (parent: { id: number }, _args: unknown, context: requestContext) => {
            return context.loaders.tagsByArticleLoader.load(parent.id)
        },
    },

    Tag: {
        articles: (parent: { id: number }) => {
            return prisma.article.findMany({
                where: { tags: { some: { id: parent.id } } },
            })
        },
    },

    Category: {
        posts: (parent: { id: number }) => {
            return prisma.post.findMany({
                where: { categories: { some: { id: parent.id } } },
            })
        },
    },

    SearchResult: {
        __resolveType(obj: { __typename?: unknown }) {
            if (searchResultTypes.includes(obj.__typename as SearchResultType)) {
                return obj.__typename
            }
            return null
        },
    },
}

export default resolvers