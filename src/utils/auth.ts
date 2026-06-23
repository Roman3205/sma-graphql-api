import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";
const SALT_ROUNDS = 10;

export interface JwtPayload {
    userId: number;
}

export function generateToken(userId: number): string {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

export function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
}

export function comparePasswords(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

export function getUserIdFromToken(authHeader: string): number | null {
    if (!authHeader) return null;

    const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : authHeader;

    if (!token) return null;

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
        return decoded.userId;
    } catch {
        return null;
    }
}