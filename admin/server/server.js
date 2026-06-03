"use strict";

/** dev 入口：起一个本地 HTTP 服务（默认 127.0.0.1:5174）。 */

const http = require("http");
const { createApp } = require("./app");

const PORT = process.env.PORT || 5174;
const HOST = process.env.HOST || "127.0.0.1";

const server = http.createServer(createApp());
server.listen(PORT, HOST, () => {
  console.log(`送了么 · 离线管理后台已启动：http://${HOST}:${PORT}`);
  console.log("纯本地离线，无需联网/鉴权/CloudBase。Ctrl+C 退出。");
});

module.exports = server;
