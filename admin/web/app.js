"use strict";
/* 纯 fetch + 原生 DOM，无框架、无 CDN，断网可用。 */

const $ = (s) => document.querySelector(s);
const api = async (method, path, body) => {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  return { ok: res.ok, status: res.status, data };
};

let FORM = null; // schema 表单元信息
let CURRENT = null; // 正在编辑的记录（null=新建）
const selected = new Set();

const STATUS_LABEL = { pending: "待审", approved: "已通过", rejected: "已拒绝" };

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add("hidden"), 2200);
}

// ---------- 启动 ----------
async function boot() {
  const { data } = await api("GET", "/api/schema");
  FORM = data.form;
  initFilters();
  bindGlobal();
  await refresh();
  const h = await api("GET", "/api/health");
  $("#health").textContent = `离线本地 · ${h.data.count} 条`;
}

function fieldMeta(key) {
  return FORM.fields.find((f) => f.key === key);
}

function initFilters() {
  const fill = (sel, key) => {
    const f = fieldMeta(key);
    const opts = f.options || [];
    sel.append(...opts.map((o) => new Option(o, o)));
  };
  fill($("#f-category"), "category");
  fill($("#f-target"), "target");
  fill($("#f-scene"), "scene");
  ["pending", "approved", "rejected"].forEach((s) =>
    $("#f-status").append(new Option(STATUS_LABEL[s], s))
  );
}

function bindGlobal() {
  ["#q", "#f-status", "#f-category", "#f-target", "#f-scene"].forEach((s) =>
    $(s).addEventListener("input", refresh)
  );
  $("#btn-new").onclick = () => openDrawer(null);
  $("#btn-import").onclick = doImport;
  $("#btn-export").onclick = doExportPreview;
  $("#drawer-close").onclick = () => $("#drawer").classList.add("hidden");
  $("#export-close").onclick = () => $("#export-modal").classList.add("hidden");
  $("#btn-save").onclick = saveForm;
  $("#btn-approve").onclick = () => setStatusCurrent("approved");
  $("#btn-reject").onclick = () => setStatusCurrent("rejected");
  $("#btn-delete").onclick = deleteCurrent;
  $("#btn-export-confirm").onclick = doExportConfirm;
  $("#check-all").onchange = (e) => {
    document.querySelectorAll(".row-check").forEach((c) => {
      c.checked = e.target.checked;
      toggleSel(c.dataset.id, e.target.checked);
    });
  };
  document.querySelectorAll("[data-batch]").forEach((b) => {
    b.onclick = () => batchStatus(b.dataset.batch);
  });
}

// ---------- 列表 ----------
async function refresh() {
  const params = new URLSearchParams();
  const q = $("#q").value.trim();
  if (q) params.set("q", q);
  for (const [id, key] of [["#f-status", "_status"], ["#f-category", "category"], ["#f-target", "target"], ["#f-scene", "scene"]]) {
    const v = $(id).value;
    if (v) params.set(key, v);
  }
  const { data } = await api("GET", "/api/directions?" + params.toString());
  renderRows(data.items);
  $("#count").textContent = `共 ${data.total} 条`;
}

function renderRows(items) {
  const tbody = $("#rows");
  tbody.innerHTML = "";
  for (const it of items) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox" class="row-check" data-id="${it.id}" /></td>
      <td>${esc(it.name)}</td>
      <td>${esc(it.category)}</td>
      <td>${(it.target || []).join("/")}</td>
      <td>${(it.scene || []).join("/")}</td>
      <td>${(it.budget || []).join("/")}</td>
      <td><span class="pill ${it._status}">${STATUS_LABEL[it._status] || it._status}</span></td>
      <td class="muted">${it._source || ""}</td>
      <td>编辑 ›</td>`;
    tr.querySelector(".row-check").onclick = (e) => {
      e.stopPropagation();
      toggleSel(it.id, e.target.checked);
    };
    tr.onclick = () => openDrawer(it);
    tbody.append(tr);
  }
}

function toggleSel(id, on) {
  if (on) selected.add(id); else selected.delete(id);
  $("#sel-count").textContent = `已选 ${selected.size}`;
}

async function batchStatus(status) {
  if (!selected.size) return toast("未选择任何条目");
  const r = await api("POST", "/api/directions/status", { ids: [...selected], status });
  toast(`已${STATUS_LABEL[status]} ${r.data.updated} 条`);
  selected.clear();
  toggleSel(null, false);
  refresh();
}

// ---------- 编辑表单（由 schema 动态生成） ----------
function openDrawer(record) {
  CURRENT = record;
  $("#drawer-title").textContent = record ? `编辑：${record.name}` : "新建方向";
  $("#form-errors").textContent = "";
  $("#btn-delete").style.display = record ? "" : "none";
  $("#btn-approve").style.display = record ? "" : "none";
  $("#btn-reject").style.display = record ? "" : "none";
  buildForm(record || {});
  $("#drawer").classList.remove("hidden");
}

function buildForm(data) {
  const form = $("#form");
  form.innerHTML = "";
  for (const f of FORM.fields) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const label = document.createElement("label");
    label.innerHTML = `${f.key}${f.required ? ' <span class="req">*</span>' : ""}` +
      (f.maxItems ? ` <span class="muted">(≤${f.maxItems})</span>` : "");
    wrap.append(label);
    wrap.append(buildControl(f, data[f.key]));
    form.append(wrap);
  }
}

function buildControl(f, value) {
  if (f.kind === "enum") {
    const sel = document.createElement("select");
    sel.dataset.key = f.key;
    sel.dataset.kind = "enum";
    sel.append(new Option("—", ""));
    f.options.forEach((o) => sel.append(new Option(o, o)));
    if (value) sel.value = value;
    return sel;
  }
  if (f.kind === "boolean") {
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.key = f.key;
    cb.dataset.kind = "boolean";
    cb.checked = !!value;
    return cb;
  }
  if (f.kind === "enumArray") {
    const box = document.createElement("div");
    box.className = "chips";
    box.dataset.key = f.key;
    box.dataset.kind = "enumArray";
    const cur = new Set(value || []);
    f.options.forEach((o) => {
      const chip = document.createElement("span");
      chip.className = "chip" + (cur.has(o) ? " on" : "");
      chip.textContent = o;
      chip.dataset.val = o;
      chip.onclick = () => chip.classList.toggle("on");
      box.append(chip);
    });
    return box;
  }
  if (f.kind === "stringArray") {
    return tagInput(f.key, value || []);
  }
  // string
  const long = f.key === "recommendReason" || (f.maxLength && f.maxLength > 30);
  const el = document.createElement(long ? "textarea" : "input");
  if (!long) el.type = "text";
  el.dataset.key = f.key;
  el.dataset.kind = "string";
  el.value = value || "";
  if (f.key === "id" && CURRENT) el.disabled = true; // id 不可改
  return el;
}

function tagInput(key, values) {
  const box = document.createElement("div");
  box.dataset.key = key;
  box.dataset.kind = "stringArray";
  const chips = document.createElement("div");
  chips.className = "chips";
  const addChip = (v) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `${esc(v)} <button type="button">×</button>`;
    chip.dataset.val = v;
    chip.querySelector("button").onclick = () => chip.remove();
    chips.append(chip);
  };
  (values || []).forEach(addChip);
  const row = document.createElement("div");
  row.className = "tag-input";
  const inp = document.createElement("input");
  inp.type = "text";
  inp.placeholder = "输入后回车添加…";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "添加";
  const commit = () => {
    const v = inp.value.trim();
    if (v) { addChip(v); inp.value = ""; }
  };
  inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } };
  btn.onclick = commit;
  row.append(inp, btn);
  box.append(chips, row);
  return box;
}

function collectForm() {
  const obj = {};
  $("#form").querySelectorAll("[data-key]").forEach((el) => {
    const key = el.dataset.key;
    const kind = el.dataset.kind;
    if (kind === "enum") { if (el.value) obj[key] = el.value; }
    else if (kind === "boolean") { obj[key] = el.checked; }
    else if (kind === "enumArray") {
      const vals = [...el.querySelectorAll(".chip.on")].map((c) => c.dataset.val);
      if (vals.length) obj[key] = vals;
    } else if (kind === "stringArray") {
      const vals = [...el.querySelectorAll(".chip")].map((c) => c.dataset.val);
      if (vals.length) obj[key] = vals;
    } else {
      const v = el.value.trim();
      if (v) obj[key] = v;
    }
  });
  return obj;
}

async function saveForm() {
  const obj = collectForm();
  $("#form-errors").textContent = "";
  const res = CURRENT
    ? await api("PUT", `/api/directions/${encodeURIComponent(CURRENT.id)}`, obj)
    : await api("POST", "/api/directions", obj);
  if (!res.ok) {
    const errs = (res.data && res.data.errors) || [res.data.error];
    $("#form-errors").textContent = "校验未通过，未写入：\n" + errs.join("\n");
    return;
  }
  toast("已保存");
  $("#drawer").classList.add("hidden");
  refresh();
}

async function setStatusCurrent(status) {
  if (!CURRENT) return;
  await api("POST", `/api/directions/${encodeURIComponent(CURRENT.id)}/status`, { status });
  toast(`已${STATUS_LABEL[status]}`);
  $("#drawer").classList.add("hidden");
  refresh();
}

async function deleteCurrent() {
  if (!CURRENT) return;
  if (!confirm(`删除「${CURRENT.name}」？`)) return;
  await api("DELETE", `/api/directions/${encodeURIComponent(CURRENT.id)}`);
  toast("已删除");
  $("#drawer").classList.add("hidden");
  refresh();
}

// ---------- 导入 / 导出 ----------
async function doImport() {
  const { data } = await api("POST", "/api/import", {});
  toast(`导入完成：新增 ${data.added}，跳过 ${data.skipped}，共 ${data.total}`);
  refresh();
}

async function doExportPreview() {
  const { data } = await api("POST", "/api/export?preview=1", {});
  $("#export-summary").textContent = data.changed
    ? "检测到变更，确认后写入 client + server 两份。"
    : "与上次导出无差异。";
  $("#export-diff").innerHTML = renderDiff(data.oldSource, data.newSource);
  $("#export-modal").classList.remove("hidden");
}

async function doExportConfirm() {
  const res = await api("POST", "/api/export", {});
  if (!res.ok) {
    toast("导出失败：" + res.data.error);
    return;
  }
  toast(`已导出 ${res.data.count} 条（两份 ${res.data.bytes} 字节，逐字节一致）`);
  $("#export-modal").classList.add("hidden");
}

function renderDiff(oldS, newS) {
  if (oldS === null) return '<span class="diff-add">（首次导出，全部为新增）</span>\n' + esc(newS.slice(0, 4000));
  if (oldS === newS) return "（无差异）";
  const o = oldS.split("\n"), n = newS.split("\n");
  const max = Math.max(o.length, n.length);
  const out = [];
  for (let i = 0; i < max; i++) {
    if (o[i] === n[i]) continue;
    if (o[i] !== undefined) out.push('<span class="diff-del">- ' + esc(o[i]) + "</span>");
    if (n[i] !== undefined) out.push('<span class="diff-add">+ ' + esc(n[i]) + "</span>");
  }
  return out.join("\n") || "（无差异）";
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

boot();
