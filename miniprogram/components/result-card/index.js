const { FEATURE_FLAGS } = require("../../shared/constants");

Component({
  data: {
    showProductShareButton: FEATURE_FLAGS.showProductShareButton,
  },

  properties: {
    item: {
      type: Object,
      value: {},
    },
  },
});
