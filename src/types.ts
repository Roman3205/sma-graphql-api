export interface PostCreateInput {
    data: {
        title: string
        content?: string
    }
}

export interface CommentCreateInput {
    data: {
        body: string
        postId: number
    }
}

export interface ArticleCreateInput {
    data: {
        title: string
        content?: string
        tagIds?: number[]
    }
}

export interface SignupInput {
    data: {
        email: string
        name: string
        password: string
    }
}

export interface LoginInput {
    data: {
        email: string
        password: string
    }
}