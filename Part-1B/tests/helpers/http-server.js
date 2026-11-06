import { once } from "node:events";

export async function withHttpServer(app, run) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    return await run(baseUrl);
  } finally {
    const closed = once(server, "close");
    server.close();
    await closed;
  }
}
