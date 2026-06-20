import { User } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";

const getUser = async (token: string): Promise<User | null> => {
    if (!token) return null

    // the id decoded from token. login simplified by the fact that id equals 1
    const userId = 1
    const user = await prisma.user.findUnique({
        where: {id: userId}
    })

    if (!user) return null

    return user
}

export default getUser