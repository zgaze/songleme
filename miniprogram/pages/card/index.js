const { getCardTemplates, getTemplatePalette } = require("../../shared/cardTemplates");

function buildGalleryItems() {
  return getCardTemplates().map((template) => {
    const palette = getTemplatePalette(template, template.defaultPaletteId);
    const sampleBless = template.fields[1] ? template.fields[1].placeholder : "";
    return {
      id: template.id,
      name: template.name,
      animationClass: template.animationClass,
      sampleBless,
      _previewBg: palette ? palette.bg : "",
      _previewText: palette ? palette.text : "",
      _accent: palette ? palette.accent : "",
    };
  });
}

Page({
  data: {
    templates: buildGalleryItems(),
  },

  onShow() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ["shareAppMessage"],
    });
  },

  chooseTemplate(event) {
    const { id } = event.currentTarget.dataset;
    if (!id) return;
    wx.navigateTo({
      url: "/pages/cardEdit/index?templateId=" + id,
    });
  },
});
