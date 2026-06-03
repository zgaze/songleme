const {
  QUESTIONS,
  RESULT_NODE,
  START_QUESTION_ID,
} = require("../../shared/questionnaire");

const QUESTION_BY_ID = QUESTIONS.reduce((map, question) => {
  map[question.id] = question;
  return map;
}, {});

const SKIPPABLE_IDS = ["target", "gender", "occupation", "recipientStyle"]; // master C3

Page({
  data: {
    questions: QUESTIONS,
    current: QUESTIONS[0],
    history: [],
    showNextButton: false,
    nextButtonText: "下一步",
    selectedValues: [],
    answers: {},
    isAdvancing: false,
    skipIds: [],
    customInputVisible: false,
    customInputValue: "",
  },

  onLoad(options) {
    const prefill = this.parsePrefill(options && options.prefill);
    const skipIds = this.parseSkip(options && options.skip).filter(
      (id) => prefill[id] !== undefined && prefill[id] !== null && prefill[id] !== ""
    );
    // 预置答案（单选字段存字符串，与既有 answers 形态一致）
    this.setData({ answers: { ...prefill }, skipIds });
    this.setQuestion(this.getFirstQuestionId(skipIds), []);
  },

  parsePrefill(raw) {
    // 注：此处 decodeURIComponent 是有意冗余——小程序 onLoad options 已自动解码一次。
    // 与结果页 pages/result 解析 answers 的写法保持一致；因 prefill 仅含 ASCII 枚举值
    // (target/gender/occupation/recipientStyle)，二次解码是无害 no-op。
    if (!raw) return {};
    try {
      const obj = JSON.parse(decodeURIComponent(raw));
      return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
    } catch (e) {
      return {};
    }
  },

  parseSkip(raw) {
    if (!raw) return [];
    return decodeURIComponent(raw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  },

  // 沿可见链找第一道不在 skipIds 里的题
  getFirstQuestionId(skipIds) {
    let question = QUESTION_BY_ID[START_QUESTION_ID];
    let guard = 0;
    while (question && guard < QUESTIONS.length) {
      if (skipIds.indexOf(question.id) < 0) return question.id;
      const values = this.getSelectedValuesFromAnswers(question, this.data.answers);
      const nextId = this.getNextQuestionId(question, values, this.data.answers);
      if (!nextId) break;
      question = QUESTION_BY_ID[nextId];
      guard += 1;
    }
    return START_QUESTION_ID;
  },

  setQuestion(questionId, history) {
    const question = QUESTION_BY_ID[questionId] || QUESTIONS[0];
    const saved = this.data.answers[question.id];
    const selectedValues = Array.isArray(saved) ? saved : saved ? [saved] : [];
    const current = this.buildQuestionState(question, selectedValues);
    const nextQuestionId = this.getNextQuestionId(question, selectedValues, this.data.answers);

    this.setData({
      current,
      history,
      showNextButton: question.type === "multi",
      nextButtonText: nextQuestionId ? "下一步" : "查看推荐",
      selectedValues,
      isAdvancing: false,
      customInputVisible: false,
      customInputValue: "",
    });
  },

  buildQuestionState(question, selectedValues) {
    const baseValues = question.options.map((o) => o.value);
    const customOptions = (selectedValues || [])
      .filter((v) => baseValues.indexOf(v) < 0)
      .map((v) => ({ value: v, label: v, _custom: true }));
    const allOptions = question.options.concat(customOptions);
    return {
      ...question,
      options: allOptions.map((option, index) => ({
        ...option,
        selected: selectedValues.indexOf(option.value) >= 0,
        shapeClass: `option--shape-${index % 6}`,
        sizeClass: `option--size-${option.size || this.getAutoOptionSize(allOptions.length, index)}`,
      })),
    };
  },

  getAutoOptionSize(count, index) {
    if (count <= 2) return "xl";
    if (count === 3) return index === 0 ? "xl" : "lg";
    if (count === 4) return index === 0 ? "xl" : index < 3 ? "lg" : "md";
    if (count <= 6) return index === 0 ? "xl" : index < 3 ? "lg" : "md";
    return index < 2 ? "lg" : index < 6 ? "md" : "sm";
  },

  getNextQuestionId(question, selectedValues, answers) {
    const values = selectedValues.length
      ? selectedValues
      : this.getSelectedValuesFromAnswers(question, answers);

    if (question.type === "single" && values.length) {
      const selectedOption = question.options.find((option) => option.value === values[0]);
      const next = selectedOption && selectedOption.next;
      return this.normalizeNextQuestionId(next || question.defaultNext);
    }

    return this.normalizeNextQuestionId(question.defaultNext);
  },

  normalizeNextQuestionId(next) {
    if (!next || next === RESULT_NODE) return "";
    return QUESTION_BY_ID[next] ? next : "";
  },

  getSelectedValuesFromAnswers(question, answers) {
    const saved = answers[question.id];
    if (Array.isArray(saved)) return saved;
    return saved ? [saved] : [];
  },

  selectOption(event) {
    if (this.data.isAdvancing) return;

    const value = event.currentTarget.dataset.value;
    const { current, selectedValues } = this.data;

    if (current.type === "multi") {
      const exists = selectedValues.indexOf(value) >= 0;

      if (current.max && !exists && selectedValues.length >= current.max) {
        wx.showToast({
          title: `最多选${current.max}个`,
          icon: "none",
        });
        return;
      }

      const nextValues = exists
        ? selectedValues.filter((item) => item !== value)
        : selectedValues.concat(value);
      this.setData({
        selectedValues: nextValues,
        current: this.buildQuestionState(current, nextValues),
      });
      return;
    }

    this.persistAnswer([value], () => {
      setTimeout(() => {
        this.goNext();
      }, 140);
    });
  },

  openCustomInput() {
    this.setData({ customInputVisible: true, customInputValue: "" });
  },

  onCustomInput(e) {
    this.setData({ customInputValue: e.detail.value });
  },

  addCustomValue() {
    const raw = (this.data.customInputValue || "").trim();
    if (!raw) {
      wx.showToast({ title: "先输入内容", icon: "none" });
      return;
    }
    const { current, selectedValues } = this.data;
    // 去重：与已选/内置 option 同名则忽略
    if (selectedValues.indexOf(raw) >= 0) {
      this.setData({ customInputVisible: false, customInputValue: "" });
      return;
    }
    if (current.type === "multi" && current.max && selectedValues.length >= current.max) {
      wx.showToast({ title: `最多选${current.max}个`, icon: "none" });
      return;
    }
    const nextValues = current.type === "multi" ? selectedValues.concat(raw) : [raw];
    // 单选自定义：直接当作选中并前进；多选：累积等用户点下一步
    if (current.type === "single") {
      this.persistAnswer(nextValues, () => setTimeout(() => this.goNext(), 140));
      this.setData({ customInputVisible: false, customInputValue: "" });
      return;
    }
    this.setData({
      selectedValues: nextValues,
      current: this.buildQuestionState(current, nextValues),
      customInputVisible: false,
      customInputValue: "",
    });
  },

  goBack() {
    const { history, skipIds } = this.data;

    if (!history.length) {
      if (getCurrentPages().length > 1) {
        wx.navigateBack();
        return;
      }

      wx.switchTab({
        url: "/pages/home/index",
      });
      return;
    }

    // 跳过被 skip 的题（正常流程它们不入 history，此为冗余防御）
    let idx = history.length - 1;
    while (idx >= 0 && skipIds.indexOf(history[idx]) >= 0) idx -= 1;
    if (idx < 0) {
      if (getCurrentPages().length > 1) {
        wx.navigateBack();
        return;
      }

      wx.switchTab({
        url: "/pages/home/index",
      });
      return;
    }

    this.setQuestion(history[idx], history.slice(0, idx));
  },

  goNext() {
    if (!this.data.selectedValues.length) {
      wx.showToast({
        title: "先选一个",
        icon: "none",
      });
      return;
    }

    this.persistCurrentAnswer(() => {
      const nextQuestionId = this.getNextQuestionId(
        this.data.current,
        this.data.selectedValues,
        this.data.answers
      );

      if (!nextQuestionId) {
        const encoded = encodeURIComponent(JSON.stringify(this.data.answers));
        wx.navigateTo({
          url: `/pages/result/index?answers=${encoded}`,
        });
        return;
      }

      this.setQuestion(nextQuestionId, this.data.history.concat(this.data.current.id));
    });
  },

  persistCurrentAnswer(callback) {
    const { current, selectedValues, answers } = this.data;
    const value = current.type === "multi" ? selectedValues : selectedValues[0];

    const nextAnswers = this.pruneAnswers({
      ...answers,
      [current.id]: value,
    });

    this.setData({ answers: nextAnswers }, callback);
  },

  persistAnswer(selectedValues, callback) {
    const { current, answers } = this.data;
    const value = current.type === "multi" ? selectedValues : selectedValues[0];

    const nextAnswers = this.pruneAnswers({
      ...answers,
      [current.id]: value,
    });
    const nextQuestionId = this.getNextQuestionId(current, selectedValues, nextAnswers);

    this.setData(
      {
        selectedValues,
        current: this.buildQuestionState(current, selectedValues),
        answers: nextAnswers,
        nextButtonText: nextQuestionId ? "下一步" : "查看推荐",
        isAdvancing: current.type !== "multi",
      },
      callback
    );
  },

  pruneAnswers(answers) {
    const visibleIds = this.getVisibleQuestionIds(answers);

    return Object.keys(answers).reduce((nextAnswers, questionId) => {
      if (visibleIds.indexOf(questionId) >= 0) {
        nextAnswers[questionId] = answers[questionId];
      }
      return nextAnswers;
    }, {});
  },

  getVisibleQuestionIds(answers) {
    const ids = [];
    let question = QUESTION_BY_ID[START_QUESTION_ID];
    let guard = 0;

    while (question && guard < QUESTIONS.length) {
      ids.push(question.id);

      const selectedValues = this.getSelectedValuesFromAnswers(question, answers);
      const nextQuestionId = this.getNextQuestionId(question, selectedValues, answers);
      if (!nextQuestionId) break;

      question = QUESTION_BY_ID[nextQuestionId];
      guard += 1;
    }

    return ids;
  },
});
