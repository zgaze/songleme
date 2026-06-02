"use strict";

/** `npm run export`：把 catalog 中 approved 的方向导出成两份运行时 JS。 */

const { Store } = require("./store");
const { writeExport } = require("./export");

const store = new Store();
try {
  const res = writeExport(store.list());
  console.log(`导出完成：${res.count} 条 approved 方向`);
  console.log(`  client → ${res.clientPath}`);
  console.log(`  server → ${res.serverPath}`);
  console.log(`  字节数：${res.bytes}（两份逐字节一致）`);
} catch (e) {
  console.error(`导出失败：${e.message}`);
  if (e.invalid) e.invalid.forEach((iv) => console.error(`  - ${iv.id}: ${iv.errors.join("; ")}`));
  process.exit(1);
}
