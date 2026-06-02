const { guideChannels, guideArticles } = require("./guideContent");

const guideArticleById = guideArticles.reduce((result, article) => {
  result[article.id] = article;
  return result;
}, {});

const legacyGuideChannels = guideChannels.map((channel) => ({
  id: channel.id,
  name: channel.name,
  summary: channel.summary,
  note: channel.note,
  accent: channel.accent,
  items: channel.articleIds
    .map((articleId) => guideArticleById[articleId])
    .filter((article) => article && article.status === "published")
    .map((article) => ({
      title: article.title,
      meaning: article.summary,
      tip: article.subtitle || article.summary,
    })),
}));

module.exports = {
  guideChannels: legacyGuideChannels,
};
