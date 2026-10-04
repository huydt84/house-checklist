import http from "node:http";
// WebKit's setOffline rejects even literal service-worker responses (upstream #42775).
// A stopped loopback proxy exercises real connection loss without that emulation bug.
export async function offlineBoundary(browserName, context, transformHtml) {
  if (browserName !== "webkit" && !transformHtml)
    return {
      url: "http://127.0.0.1:3001",
      offline: () => context.setOffline(true),
      online: () => context.setOffline(false),
      close: async () => {},
    };
  const proxy = http.createServer((req, res) => {
    const upstream = http.request(
      {
        hostname: "127.0.0.1",
        port: 3001,
        path: req.url,
        method: req.method,
        headers: transformHtml
          ? {
              ...req.headers,
              "accept-encoding": "identity",
              "if-none-match": "",
            }
          : req.headers,
      },
      (result) => {
        if (transformHtml && req.url === "/" && result.statusCode === 200) {
          const chunks = [];
          result.on("data", (chunk) => chunks.push(chunk));
          result.on("end", () => {
            const body = transformHtml(Buffer.concat(chunks).toString());
            const headers = { ...result.headers, "cache-control": "no-store" };
            delete headers["content-length"];
            delete headers.etag;
            res.writeHead(result.statusCode, headers);
            res.end(body);
          });
          return;
        }
        res.writeHead(result.statusCode, result.headers);
        result.pipe(res);
      },
    );
    upstream.on("error", () => {
      res.destroy();
    });
    req.pipe(upstream);
  });
  let port;
  const start = () =>
    new Promise((resolve) =>
      proxy.listen(port || 0, "127.0.0.1", () => {
        port = proxy.address().port;
        resolve();
      }),
    );
  const stop = () =>
    new Promise((resolve) => {
      if (!proxy.listening) return resolve();
      proxy.closeAllConnections();
      proxy.close(resolve);
    });
  await start();
  return {
    url: `http://127.0.0.1:${port}`,
    offline: stop,
    online: start,
    close: stop,
  };
}
