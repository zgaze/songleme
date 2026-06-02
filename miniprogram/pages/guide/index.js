const {
  GUIDE_CONTENT_VERSION,
  getGuideArticleById,
  getPublishedGuideArticlesByChannel,
  getPublishedGuideChannels,
} = require("../../shared/guideContent");

const articleTones = ["sky", "rose", "leaf", "apricot"];

const channels = getPublishedGuideChannels();
const initialChannel = channels[0] || null;
const initialArticles = initialChannel ? getArticleCards(initialChannel.id) : [];
const initialArticle = initialArticles[0] ? getGuideArticleById(initialArticles[0].id) : null;

function getArticleCards(channelId) {
  return getPublishedGuideArticlesByChannel(channelId).map((article, index) => ({
    id: article.id,
    title: article.title,
    summary: article.summary,
    readingMinutes: article.readingMinutes,
    tone: articleTones[index % articleTones.length],
  }));
}

Page({
  data: {
    contentVersion: GUIDE_CONTENT_VERSION,
    channels,
    articles: initialArticles,
    selectedChannelId: initialChannel ? initialChannel.id : "",
    selectedArticleId: initialArticle ? initialArticle.id : "",
    currentChannel: initialChannel,
    currentArticle: initialArticle,
  },

  selectChannel(event) {
    const { id } = event.currentTarget.dataset;
    const currentChannel = channels.find((channel) => channel.id === id);

    if (!currentChannel || currentChannel.id === this.data.selectedChannelId) {
      return;
    }

    const articles = getArticleCards(currentChannel.id);
    const currentArticle = articles[0] ? getGuideArticleById(articles[0].id) : null;

    this.setData({
      articles,
      selectedChannelId: currentChannel.id,
      selectedArticleId: currentArticle ? currentArticle.id : "",
      currentChannel,
      currentArticle,
    });
  },

  selectArticle(event) {
    const { id } = event.currentTarget.dataset;

    if (!id || id === this.data.selectedArticleId) {
      return;
    }

    const currentArticle = getGuideArticleById(id);
    if (!currentArticle) {
      return;
    }

    this.setData({
      selectedArticleId: id,
      currentArticle,
    });
  },
});
