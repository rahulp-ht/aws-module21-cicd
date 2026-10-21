
const http = require("http");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (req.url === "/health") {
    res.writeHead(200);
    return res.end(JSON.stringify({ status: "healthy" }));
  }

  if (req.url === "/") {
    res.writeHead(200);
    return res.end(JSON.stringify({
      message: "Hello from AWS Module 21!",
      service: "sample-api",
      version: "1.0.0"
    }));
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

