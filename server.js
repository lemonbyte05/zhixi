/* ============================================================
   知息 ZHI XI · 本地静态服务 + Agent LLM 代理
   ------------------------------------------------------------
   P0-2 安全设计：
     Browser → POST /api/chat → 本服务端 → DeepSeek
     - API Key 只从环境变量 DEEPSEEK_API_KEY 读取
     - Key 绝不出现在任何 HTML/JS/响应体中
     - 未配置 Key：/api/chat 返回 {fallback:true}，前端自动回落本地规则引擎
   启动：
     node server.js                            （纯本地 fallback 模式）
     DEEPSEEK_API_KEY=sk-xxx node server.js    （Agent 完整模式）
   ============================================================ */
const http = require("http");
const fs = require("fs");
const path = require("path");
const root = __dirname;
const PORT = process.env.PORT || 4923;
const mime = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json"
};

function readBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [], size = 0;
    req.on("data", function (c) {
      size += c.length;
      if (size > 512 * 1024) { reject(new Error("body_too_large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", function () { resolve(Buffer.concat(chunks).toString("utf8")); });
    req.on("error", reject);
  });
}

async function handleChat(req, res) {
  var key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    res.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ fallback: true, error: "DEEPSEEK_API_KEY not configured; frontend will use local rule engine." }));
    return;
  }
  try {
    var body = JSON.parse(await readBody(req));
    var payload = {
      model: typeof body.model === "string" ? body.model.slice(0, 64) : "deepseek-chat",
      messages: Array.isArray(body.messages) ? body.messages.slice(-12) : [],
      temperature: typeof body.temperature === "number" ? body.temperature : 0.4,
      max_tokens: Math.min(typeof body.max_tokens === "number" ? body.max_tokens : 700, 1200)
    };
    // 透传工具定义（Agent 真·function-calling 需要）；防止非法结构
    if (Array.isArray(body.tools)) payload.tools = body.tools.slice(0, 12);
    if (!payload.messages.length) throw new Error("empty_messages");
    var upstream = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
      body: JSON.stringify(payload)
    });
    var text = await upstream.text();
    res.writeHead(upstream.status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(text);
  } catch (e) {
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ fallback: true, error: "upstream_error" }));
  }
}

http.createServer(async function (req, res) {
  var u = decodeURIComponent((req.url || "/").split("?")[0]);
  if (u === "/api/chat" && req.method === "POST") return handleChat(req, res);
  if (u === "/api/chat") { res.writeHead(405); return res.end(); }
  if (u === "/") u = "/index.html";
  var fp = path.join(root, u);
  if (!fp.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, function (err, buf) {
    if (err) { res.writeHead(404); return res.end("Not Found"); }
    res.writeHead(200, {
      "Content-Type": mime[path.extname(fp)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(buf);
  });
}).listen(PORT, "127.0.0.1", function () {
  console.log("zhixi preview at http://127.0.0.1:" + PORT +
    "  [Agent LLM proxy: " + (process.env.DEEPSEEK_API_KEY ? "ON (key from env)" : "OFF (fallback mode)") + "]");
});
