export interface UserCreateInput {data: {email: string, name: string, posts: {title: string, content?: string, published?: boolean}[]}}

export interface PostCreateInput {data: {title: string, content: string, authorId: number}}