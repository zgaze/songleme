const {
  getCardTemplates,
  getCardTemplateById,
  getTemplatePalette,
} = require("../../shared/cardTemplates");

// 导出画布的逻辑尺寸（px），3:4 竖版贺卡
const LOGIC_W = 300;
const LOGIC_H = 400;

function fieldMaxLen(template, key, fallback) {
  const field = template.fields.find((f) => f.key === key);
  return field && typeof field.maxLen === "number" ? field.maxLen : fallback;
}

function fieldDefault(template, key) {
  const field = template.fields.find((f) => f.key === key);
  return field && typeof field.default === "string" ? field.default : "";
}

Page({
  data: {
    template: null,
    paletteId: "",
    palette: null,
    templates: [],
    salutation: "",
    blessing: "",
    saluMax: 12,
    blesMax: 40,
    exportW: LOGIC_W,
    exportH: LOGIC_H,
    exporting: false,
  },

  // 最近一次成功导出的临时文件路径（供分享 imageUrl 复用）
  _lastTempFilePath: "",

  onLoad(options) {
    const templateId = options && options.templateId;
    const template = getCardTemplateById(templateId) || getCardTemplates()[0];
    const palette = getTemplatePalette(template, template.defaultPaletteId);
    const saluMax = fieldMaxLen(template, "salutation", 12);
    const blesMax = fieldMaxLen(template, "blessing", 40);

    this.setData({
      template,
      palette,
      paletteId: palette ? palette.id : "",
      templates: getCardTemplates(),
      salutation: fieldDefault(template, "salutation"),
      blessing: fieldDefault(template, "blessing"),
      saluMax,
      blesMax,
    });
  },

  onShow() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ["shareAppMessage"],
    });
  },

  switchTemplate(event) {
    const { id } = event.currentTarget.dataset;
    if (!id || (this.data.template && id === this.data.template.id)) {
      return;
    }
    const template = getCardTemplateById(id);
    if (!template) return;

    const palette = getTemplatePalette(template, template.defaultPaletteId);
    const saluMax = fieldMaxLen(template, "salutation", 12);
    const blesMax = fieldMaxLen(template, "blessing", 40);

    // 新模板字段 maxLen 可能更小，截断现有文本避免残留超长内容
    const salutation = this.data.salutation.slice(0, saluMax);
    const blessing = this.data.blessing.slice(0, blesMax);

    this.setData({
      template,
      palette,
      paletteId: palette ? palette.id : "",
      saluMax,
      blesMax,
      salutation,
      blessing,
    });
  },

  switchPalette(event) {
    const { id } = event.currentTarget.dataset;
    if (!id || id === this.data.paletteId) return;
    const palette = getTemplatePalette(this.data.template, id);
    if (!palette) return;
    this.setData({ palette, paletteId: palette.id });
  },

  onSalutationInput(event) {
    this.setData({ salutation: event.detail.value });
  },

  onBlessingInput(event) {
    this.setData({ blessing: event.detail.value });
  },

  // ---- 导出（Canvas 2D 静态快照）-----------------------------

  exportCardImage() {
    return new Promise((resolve, reject) => {
      let dpr = 2;
      try {
        const info = wx.getSystemInfoSync();
        dpr = info && info.pixelRatio ? info.pixelRatio : 2;
      } catch (e) {
        dpr = 2;
      }

      const logicW = LOGIC_W;
      const logicH = LOGIC_H;
      const query = wx.createSelectorQuery().in(this);
      query
        .select("#cardCanvas")
        .fields({ node: true, size: true })
        .exec((res) => {
          const canvasNode = res && res[0] && res[0].node;
          if (!canvasNode) {
            reject(new Error("canvas node not found"));
            return;
          }
          const ctx = canvasNode.getContext("2d");
          // 物理像素 = 逻辑 * dpr，再缩放 ctx，保证清晰不糊
          canvasNode.width = logicW * dpr;
          canvasNode.height = logicH * dpr;
          ctx.scale(dpr, dpr);
          this.drawCard(ctx, logicW, logicH);
          wx.canvasToTempFilePath({
            canvas: canvasNode, // Canvas 2D 必须传 canvas 节点，不传 canvasId
            x: 0,
            y: 0,
            width: logicW,
            height: logicH,
            destWidth: logicW * dpr,
            destHeight: logicH * dpr,
            success: (r) => resolve(r.tempFilePath),
            fail: reject,
          });
        });
    });
  },

  drawCard(ctx, w, h) {
    const palette = this.data.palette || { bg: "#ffffff", text: "#2a2126", accent: "#cccccc" };
    const template = this.data.template;
    const saluPh = template && template.fields[0] ? template.fields[0].placeholder : "";
    const blesPh = template && template.fields[1] ? template.fields[1].placeholder : "";
    const salutation = this.data.salutation || saluPh;
    const blessing = this.data.blessing || blesPh;

    // 1. 背景（纯色 hex，与预览一致）
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, w, h);

    // 2. 顶部点缀色带（与预览版式对应）
    ctx.fillStyle = palette.accent;
    this.roundRect(ctx, 28, 30, 96, 12, 6);
    ctx.fill();

    // 3. 文字
    const padX = 28;

    // 称呼
    ctx.fillStyle = palette.text;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.font = "600 22px sans-serif";
    ctx.fillText(salutation, padX, 96, w - padX * 2);

    // 祝福（手动折行）
    ctx.font = "400 18px sans-serif";
    const lineHeight = 28;
    const maxLines = 4;
    const lines = this.wrapText(ctx, blessing, w - padX * 2, maxLines);
    let y = 142;
    lines.forEach((line) => {
      ctx.fillText(line, padX, y);
      y += lineHeight;
    });

    // 署名（底部右对齐）
    ctx.font = "400 14px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("—— 送了么", w - padX, h - 32);
  },

  // 画圆角矩形路径（canvas 2D 无内建 roundRect 兼容封装）
  roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  },

  // 按测量宽度折行；超过 maxLines 时最后一行截断加省略号
  wrapText(ctx, text, maxWidth, maxLines) {
    const chars = String(text).split("");
    const lines = [];
    let current = "";

    for (let i = 0; i < chars.length; i += 1) {
      const ch = chars[i];
      if (ch === "\n") {
        lines.push(current);
        current = "";
        if (lines.length >= maxLines) break;
        continue;
      }
      const test = current + ch;
      if (ctx.measureText(test).width > maxWidth && current !== "") {
        lines.push(current);
        current = ch;
        if (lines.length >= maxLines) {
          current = "";
          break;
        }
      } else {
        current = test;
      }
    }

    if (current !== "" && lines.length < maxLines) {
      lines.push(current);
    }

    // 若仍有未绘制内容（被截断），给最后一行加省略号
    if (lines.length >= maxLines) {
      const consumed = lines.join("").length;
      if (consumed < chars.length) {
        let last = lines[maxLines - 1];
        while (last.length > 0 && ctx.measureText(last + "…").width > maxWidth) {
          last = last.slice(0, -1);
        }
        lines[maxLines - 1] = last + "…";
      }
      return lines.slice(0, maxLines);
    }

    return lines;
  },

  // ---- 保存到相册（含授权）----------------------------------

  saveToAlbum() {
    if (this.data.exporting) return;
    this.setData({ exporting: true });
    this.exportCardImage()
      .then((tempFilePath) => {
        this._lastTempFilePath = tempFilePath;
        return this.persistToAlbum(tempFilePath);
      })
      .then(() => {
        wx.showToast({ title: "已保存到相册", icon: "success" });
      })
      .catch((err) => {
        this.handleSaveError(err);
      })
      .finally(() => {
        this.setData({ exporting: false });
      });
  },

  persistToAlbum(tempFilePath) {
    return new Promise((resolve, reject) => {
      wx.saveImageToPhotosAlbum({
        filePath: tempFilePath,
        success: resolve,
        fail: reject,
      });
    });
  },

  handleSaveError(err) {
    const msg = (err && err.errMsg) || "";
    if (msg.indexOf("auth") >= 0 || msg.indexOf("deny") >= 0) {
      wx.showModal({
        title: "需要相册权限",
        content: "保存贺卡需要授权访问相册，请在设置中开启。",
        confirmText: "去设置",
        success: (r) => {
          if (r.confirm) wx.openSetting();
        },
      });
      return;
    }
    if (msg.indexOf("cancel") >= 0) return; // 用户主动取消，不打扰
    wx.showToast({ title: "保存失败，请重试", icon: "none" });
  },

  onShareAppMessage() {
    const share = {
      title: "我给你做了一张贺卡",
      path: "/pages/card/index",
    };
    if (this._lastTempFilePath) {
      share.imageUrl = this._lastTempFilePath;
    }
    return share;
  },
});
