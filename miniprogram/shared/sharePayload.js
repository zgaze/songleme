const HOME_PATH = "/pages/home/index";
const QUESTION_PATH = "/pages/question/index";
const MYSTERY_PATH = "/pages/shareMystery/index";
const PRODUCT_PATH = "/pages/shareProduct/index";

function encodeSharePayload(payload) {
  try {
    return encodeURIComponent(JSON.stringify(payload || {}));
  } catch (error) {
    return "";
  }
}

function decodeSharePayload(rawPayload) {
  if (!rawPayload) return {};

  try {
    return JSON.parse(decodeURIComponent(rawPayload));
  } catch (error) {
    return {};
  }
}

function buildSharePath(pagePath, payload) {
  const encoded = encodeSharePayload(payload);
  return encoded ? `${pagePath}?p=${encoded}` : pagePath;
}

function buildHomeShare() {
  return {
    title: "送了么：帮你挑一份不出错的礼物",
    path: `${HOME_PATH}?fromShare=home`,
  };
}

function buildMysteryShare(result = {}) {
  const payload = {
    v: 1,
    type: "mystery",
    runId: result.meta && result.meta.runId ? result.meta.runId : "",
    summary: trimText(result.summary, 42),
    pairingText: trimText(result.pairingText, 28),
  };

  return {
    title: "我给你准备了一个神秘礼物",
    path: buildSharePath(MYSTERY_PATH, payload),
  };
}

function buildMysteryShareById(shareId) {
  if (!shareId) return buildMysteryShare();

  return {
    title: "我给你准备了一个神秘礼物",
    path: `${MYSTERY_PATH}?id=${encodeURIComponent(shareId)}`,
  };
}

function buildProductShare(product = {}) {
  const payload = {
    v: 1,
    type: "product",
    id: trimText(product.id, 48),
    name: trimText(product.name, 28),
    reason: trimText(product.recommendReason || product.reason || product.shortReason || product.highlights, 46),
    tags: normalizeTags(product.displayTags || product.tags || product.recommendTags || product.highlights),
    imageUrl: trimImageUrl(product.imageUrl),
  };

  const title = payload.name
    ? `我觉得这个礼物很适合：${payload.name}`
    : "我发现了一个适合送人的礼物";

  return {
    title: trimText(title, 30),
    path: buildSharePath(PRODUCT_PATH, payload),
    imageUrl: payload.imageUrl || undefined,
  };
}

function buildProductShareById(shareId, product = {}) {
  if (!shareId) return buildProductShare(product);

  const title = product.name
    ? `我觉得这个礼物很适合：${product.name}`
    : "我发现了一个适合送人的礼物";

  return {
    title: trimText(title, 30),
    path: `${PRODUCT_PATH}?id=${encodeURIComponent(shareId)}`,
    imageUrl: product.imageUrl || undefined,
  };
}

function trimText(value, limit) {
  const text = Array.isArray(value) ? value.join("，") : String(value || "");
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function normalizeTags(tags) {
  return (Array.isArray(tags) ? tags : [tags])
    .filter(Boolean)
    .map((tag) => trimText(tag, 8))
    .filter(Boolean)
    .slice(0, 3);
}

function trimImageUrl(imageUrl) {
  const text = String(imageUrl || "");
  if (!text || text.length > 240) return "";
  return text;
}

module.exports = {
  HOME_PATH,
  QUESTION_PATH,
  MYSTERY_PATH,
  PRODUCT_PATH,
  buildHomeShare,
  buildMysteryShare,
  buildMysteryShareById,
  buildProductShare,
  buildProductShareById,
  decodeSharePayload,
};
