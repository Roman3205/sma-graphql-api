import { ApolloServer } from "@apollo/server";
import "dotenv/config";
import resolvers from "./resolvers";
import express from "express";
import http from "http";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import cors from "cors";
import { expressMiddleware } from "@as-integrations/express5";
import { getUserIdFromToken } from "./utils/auth";
import { GraphQLFormattedError } from "graphql";
import { readFileSync } from "fs";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/use/ws";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { createLoaders, Loaders } from "./lib/dataloader";
import responseCachePlugin from "@apollo/server-plugin-response-cache";
import { depthLimit } from "@graphile/depth-limit";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";

const typeDefs = readFileSync("./src/schema.graphql", { encoding: "utf-8" });

export interface requestContext {
    userId: number | null;
    loaders: Loaders;
    res?: express.Response;
}

const startServer = async () => {
    try {
        const PORT = process.env.PORT || 4000;

        const app = express();
        app.use(cookieParser());
        const httpServer = http.createServer(app);

        const schema = makeExecutableSchema({ typeDefs, resolvers });

        const wsServer = new WebSocketServer({
            server: httpServer,
            path: "/graphql",
        });
        const wsServerCleanup = useServer(
            {
                schema,
                context: async (ctx) => {
                    const req = ctx.extra.request as any;
                    if (req && !req.cookies) {
                        cookieParser()(req, {} as any, () => {});
                    }
                    const token = (ctx.connectionParams?.Authorization as string) || req?.cookies?.["apollo-token"] || "";
                    const userId = getUserIdFromToken(token);
                    return {
                        userId,
                        loaders: createLoaders(),
                    };
                },
            },
            wsServer
        );

        const server = new ApolloServer<requestContext>({
            schema,
            validationRules: [
                depthLimit({
                    maxDepth: 6,
                    maxListDepth: 3,
                    maxSelfReferentialDepth: 2,
                }),
            ],
            plugins: [
                ApolloServerPluginDrainHttpServer({ httpServer }),
                {
                    async serverWillStart() {
                        return {
                            async drainServer() {
                                await wsServerCleanup.dispose();
                            },
                        };
                    },
                },
                responseCachePlugin(),
            ],

            formatError: (
                formattedError: GraphQLFormattedError,
                _error: unknown
            ): GraphQLFormattedError => {
                console.error("[GraphQL Error]", formattedError.message);

                if (formattedError.extensions?.code === "INTERNAL_SERVER_ERROR") {
                    return {
                        message: "An internal server error occurred",
                        extensions: { code: "INTERNAL_SERVER_ERROR" },
                    };
                }

                return {
                    message: formattedError.message,
                    extensions: {
                        code: formattedError.extensions?.code || "UNKNOWN_ERROR",
                        ...(formattedError.path && { path: formattedError.path }),
                    },
                };
            },
        });

        await server.start();

        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];

        const corsOptions: cors.CorsOptions = {
            origin: (origin, callback) => {
                if (!origin || allowedOrigins.includes(origin)) {
                    callback(null, true);
                } else {
                    callback(new Error("Not allowed by CORS"));
                }
            },
            methods: ["GET", "POST", "OPTIONS"],
            allowedHeaders: [
                "Content-Type",
                "Authorization",
                "Apollo-Require-Preflight",
            ],
            credentials: true,
        };

        const graphqlLimiter = rateLimit({
            windowMs: 1 * 60 * 1000,
            max: 100,
            standardHeaders: true,
            legacyHeaders: false,
            message: {
                errors: [
                    {
                        message: "Too many requests, please try again later",
                        extensions: { code: "RATE_LIMITED" },
                    },
                ],
            },
        });

        app.use(
            "/graphql",
            cors(corsOptions),
            express.json(),
            graphqlLimiter,
            expressMiddleware(server, {
                context: async ({ req, res }) => {
                    const token = req.headers.authorization || req.cookies?.["apollo-token"] || "";
                    const userId = getUserIdFromToken(token);
                    const loaders = createLoaders();

                    return { userId, loaders, res };
                },
            })
        );

        app.get("/health", (_req, res) => {
            res.json({ status: "ok", message: "Server is running" });
        });

        await new Promise<void>((resolve) =>
            httpServer.listen({ port: PORT }, resolve)
        );

        console.log(`Server is running at http://localhost:${PORT}/graphql`);
        console.log(`Websocket server at ws://localhost:${PORT}/graphql`);
    } catch (error) {
        console.error("Error starting server:", error);
        process.exit(1);
    }
};

startServer();