import * as process from "node:process";
import { buildApp } from "./app.js";

const app = buildApp();

const port = Number(process.env.API_PORT ?? 3001);
const host = process.env.API_HOST ?? "0.0.0.0";

async function start() {
  try {
    await app.listen({
      port,
      host,
    });

    app.log.info(`API listening on ${host}:${port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();
