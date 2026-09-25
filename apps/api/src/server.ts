import Fastify from "fastify";
import "dotenv/config";
import * as process from "node:process";
import {config} from "dotenv";
import {expand} from "dotenv-expand";

const env = config({
    path: "../../.env",
});
expand(env)

const app = Fastify({
    logger: true,
});

app.get("/health", async () => {
    return {
        status: "ok",
    };
});

const start = async () => {
    try {
        await app.listen({
            port: 3001,
            host: "0.0.0.0",
        });
    } catch (error) {
        app.log.error(error);
        process.exit(1);
    }
};

start();