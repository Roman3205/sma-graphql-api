import { GraphQLError } from "graphql"
import { prisma } from "./lib/prisma"
import { requestContext } from "./server"
import { PostCreateInput, UserCreateInput } from "./types"

const resolvers = {
    Query: {
        posts: () => {
            return prisma.post.findMany({
                where: {published: true}
            })
        },
        post: (_: unknown, args: {id: string}) => {
            return prisma.post.findUnique({
                where: {id: Number(args.id)}
            })
        }
    },
    Mutation: {
        createDraft: (_: unknown, args: PostCreateInput) => {
            return prisma.post.create({
                data: {
                    content: args.data.content,
                    title: args.data.title,
                    ...(args.data.authorId && {
                        author: {
                            connect: {id: args.data.authorId}
                        }
                    })
                }
            })
        },
        publishPost: (_: unknown, args: {id: string}) => {
            return prisma.post.update({
                where: {
                    id: Number(args.id)
                },
                data: {
                    published: true
                }
            })
        },
        createUser: (_: unknown, args: UserCreateInput, context: requestContext) => {
            if (context.userId !== 'admin') {
                throw new GraphQLError("Not enough rights", {
                    extensions: {
                        code: 'FORBIDDEN',
                        http: {status: 403}
                    }
                })
            }

            return prisma.user.create({
                data: {
                    email: args.data.email,
                    name: args.data.name,
                    posts: {
                        create: args.data.posts,
                    },
                },
            })
        }
    },
    User: {
        posts: (parent: {id: string}) => {
            return prisma.post.findMany({
                where: {authorId: Number(parent.id)}
            })
        }
    },
    Post: {
        author: (parent: {id: string}) => {
            return prisma.post.findUnique({
                where: {id: Number(parent.id)}
            }).author()
        }
    }
}

export default resolvers