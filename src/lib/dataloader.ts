import DataLoader from "dataloader"
import { prisma } from "./prisma"

export function createLoaders() {
    return {
        userLoader: new DataLoader<number, any>(async (userIds) => {
            const users = await prisma.user.findMany({
                where: { id: { in: [...userIds] } },
            })
            const userMap = new Map(users.map((u) => [u.id, u]))
            return userIds.map((id) => userMap.get(id) || null)
        }),

        commentsByPostLoader: new DataLoader<number, any[]>(async (postIds) => {
            const comments = await prisma.comment.findMany({
                where: { postId: { in: [...postIds] } },
            })
            const grouped = new Map<number, any[]>()
            for (const c of comments) {
                if (!grouped.has(c.postId)) grouped.set(c.postId, [])
                grouped.get(c.postId)!.push(c)
            }
            return postIds.map((id) => grouped.get(id) || [])
        }),

        tagsByArticleLoader: new DataLoader<number, any[]>(async (articleIds) => {
            const articles = await prisma.article.findMany({
                where: { id: { in: [...articleIds] } },
                include: { tags: true },
            })
            const map = new Map(articles.map((a) => [a.id, a.tags]))
            return articleIds.map((id) => map.get(id) || [])
        }),

        categoriesByPostLoader: new DataLoader<number, any[]>(async (postIds) => {
            const posts = await prisma.post.findMany({
                where: { id: { in: [...postIds] } },
                include: { categories: true },
            })
            const map = new Map(posts.map((p) => [p.id, p.categories]))
            return postIds.map((id) => map.get(id) || [])
        }),

        postLoader: new DataLoader<number, any>(async (postIds) => {
            const posts = await prisma.post.findMany({
                where: { id: { in: [...postIds] } },
            })
            const postMap = new Map(posts.map((p) => [p.id, p]))
            return postIds.map((id) => postMap.get(id) || null)
        }),
    }
}

export type Loaders = ReturnType<typeof createLoaders>
