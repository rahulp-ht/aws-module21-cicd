
const http = require("http");
const os = require("os");
const crypto = require("crypto");

const PORT = Number(process.env.PORT) || 3000;
const APP_NAME = "module21-api";
const VERSION = "2.0.0";
const START_TIME = Date.now();

const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  routes: {},
};

const products = Array.from({ length: 100 }, (_, i) => ({
  id: i + 1,
  name: `Product-${String(i + 1).padStart(3, "0")}`,
  category: ["compute", "storage", "network", "security"][i % 4],
  price: Number((10 + Math.random() * 990).toFixed(2)),
  inStock: i % 5 !== 0,
}));

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });

  res.end(JSON.stringify(data));
}

function getSystemInfo() {
  const cpus = os.cpus();

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    architecture: os.arch(),
    cpuCount: cpus.length,
    totalMemoryMB: Math.round(os.totalmem() / 1024 / 1024),
    freeMemoryMB: Math.round(os.freemem() / 1024 / 1024),
    processMemoryMB: Math.round(
      process.memoryUsage().rss / 1024 / 1024
    ),
    processUptimeSeconds: Math.round(process.uptime()),
    applicationUptimeSeconds: Math.round(
      (Date.now() - START_TIME) / 1000
    ),
  };
}

function handleRequest(req, res) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  metrics.totalRequests++;
  metrics.routes[url.pathname] =
    (metrics.routes[url.pathname] || 0) + 1;

  res.setHeader("X-Request-Id", requestId);

  function respond(status, body) {
    if (status >= 400) {
      metrics.failedRequests++;
    } else {
      metrics.successfulRequests++;
    }

    console.log(JSON.stringify({
      requestId,
      method: req.method,
      path: url.pathname,
      status,
      durationMs: Date.now() - startedAt,
    }));

    sendJson(res, status, {
      requestId,
      ...body,
    });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return respond(405, {
      error: "Method not allowed",
    });
  }

  switch (url.pathname) {
    case "/":
      return respond(200, {
        message: "Welcome to the enhanced AWS Module 21 API",
        service: APP_NAME,
        version: VERSION,
        endpoints: [
          "/health",
          "/ready",
          "/info",
          "/metrics",
          "/api/products",
          "/api/products/:id",
        ],
      });

    case "/health":
      return respond(200, {
        status: "healthy",
        service: APP_NAME,
      });

    case "/ready":
      return respond(200, {
        status: "ready",
        timestamp: new Date().toISOString(),
      });

    case "/info":
      return respond(200, {
        service: APP_NAME,
        version: VERSION,
        environment: process.env.NODE_ENV || "development",
        nodeVersion: process.version,
        system: getSystemInfo(),
      });

    case "/metrics":
      return respond(200, {
        ...metrics,
        uptimeSeconds: Math.round(process.uptime()),
      });

    case "/api/products": {
      const category = url.searchParams.get("category");
      const search = url.searchParams.get("search");
      const page = Math.max(
        1,
        Number.parseInt(url.searchParams.get("page") || "1", 10) || 1
      );
      const limit = Math.min(
        50,
        Math.max(
          1,
          Number.parseInt(url.searchParams.get("limit") || "10", 10) || 10
        )
      );

      let filtered = products;

      if (category) {
        filtered = filtered.filter(
          (p) => p.category === category.toLowerCase()
        );
      }

      if (search) {
        filtered = filtered.filter(
          (p) => p.name.toLowerCase().includes(search.toLowerCase())
        );
      }

      const total = filtered.length;
      const start = (page - 1) * limit;

      return respond(200, {
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        products: filtered.slice(start, start + limit),
      });
    }

    default:
      break;
  }

  const productMatch = url.pathname.match(/^\/api\/products\/(\d+)$/);

  if (productMatch) {
    const product = products.find(
      (p) => p.id === Number(productMatch[1])
    );

    if (!product) {
      return respond(404, {
        error: "Product not found",
      });
    }

    return respond(200, { product });
  }

  return respond(404, {
    error: "Route not found",
    path: url.pathname,
  });
}

const server = http.createServer((req, res) => {
  try {
    handleRequest(req, res);
  } catch (error) {
    console.error("Request processing failed:", error);

    if (!res.headersSent) {
      sendJson(res, 500, {
        error: "Internal server error",
      });
    } else if (!res.writableEnded) {
      res.end();
    }
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`${APP_NAME} v${VERSION} listening on port ${PORT}`);
});

function shutdown(signal) {
  console.log(`${signal} received; shutting down gracefully`);

  server.close((error) => {
    if (error) {
      console.error("Shutdown failed:", error);
      process.exitCode = 1;
    }
  });

  setTimeout(() => {
    console.error("Graceful shutdown timed out");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));


