import {config} from "dotenv";
import {expand} from "dotenv-expand";

const env = config({
    path: "../../.env",
});
expand(env)

console.log('Hello World!');
