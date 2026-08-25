const http = require("http");
const fs = require("fs");
const path = require("path");
const root = __dirname;
const mime = {".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".json":"application/json"};
http.createServer((req,res)=>{
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const fp = path.join(root, p);
  if (!fp.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("Not Found"); }
    res.writeHead(200, {"Content-Type": mime[path.extname(fp)] || "application/octet-stream", "Cache-Control": "no-store"});
    res.end(buf);
  });
}).listen(4923, "127.0.0.1", () => console.log("zhixi preview at http://127.0.0.1:4923"));
