import * as process from "node:process";

export default function Home() {
  return (
    <>
      <h1>ENV</h1>
      <p>{process.env.NODE_ENV}</p>
    </>
  );
}
