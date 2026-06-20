import { ApolloServer } from "@apollo/server";
import "dotenv/config";
import resolvers from './resolvers';
import express from 'express';
import http from 'http';
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import cors from 'cors';
import { expressMiddleware } from "@as-integrations/express5";
import getUser from "./utils/auth";
import { GraphQLError } from "graphql";
import { readFileSync } from "fs";

const typeDefs = readFileSync('./src/schema.graphql', {encoding: 'utf-8'})

export interface requestContext {
    userId: number | 'admin'
}

const startServer = async () => {
    try {
        const PORT = process.env.PORT || 4000
    
        const app = express()
        const httpServer = http.createServer(app)

        const server = new ApolloServer<requestContext>({
            typeDefs,
            resolvers,
            plugins: [ApolloServerPluginDrainHttpServer({httpServer})]
        })

        await server.start()

        app.use('/graphql', cors(), express.json(), expressMiddleware(server, {
            context: async ({req, res}) => {
                const query = req.body.query || ''
                const operationName = req.body.operationName || ''
                const isCreateUserRequest = operationName === 'CreateUser' || query.includes('CreateUser') || query.includes('IntrospectionQuery')
                const token = req.headers.authorization || ''
                const user = await getUser(token)

                // admin has no auth
                if (!user && isCreateUserRequest) return {userId: ('admin') as const}

                if (!user) {
                    throw new GraphQLError("Authentication error", {
                        extensions: {
                            code: 'UNAUTHENTICATED',
                            http: {status: 401}
                        }
                    })
                }
                return {userId: user.id}
            }
        }))

        app.get('/health', (req, res) => {
            res.json({ status: 'ok', message: 'Server is running' });
        });

        await new Promise<void>((resolve) => httpServer.listen({port: PORT}, resolve))

        console.log(`Server is running at http://localhost:${PORT}/graphql`);
        console.log(`Health check at http://localhost:${PORT}/health`);

    } catch (error) {
        console.error('Error starting server:', error);
        process.exit(1)
    }
}


startServer()