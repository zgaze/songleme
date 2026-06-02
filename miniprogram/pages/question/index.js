const {
  QUESTIONS,
  RESULT_NODE,
  START_QUESTION_ID,
} = require("../../shared/questionnaire");

const QUESTION_BY_ID = QUESTIONS.reduce((map, question) => {
  map[question.id] = question;
  return map;
}, {});

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
  },

  onLoad() {
    this.setQuestion(START_QUESTION_ID, []);
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
    });
  },

  buildQuestionState(question, selectedValues) {
    return {
      ...question,
      options: question.options.map((option, index) => ({
        ...option,
        selected: selectedValues.indexOf(option.value) >= 0,
        shapeClass: `option--shape-${index % 6}`,
        sizeClass: `option--size-${option.size || this.getAutoOptionSize(question.options.length, index)}`,
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

  goBack() {
    const { history } = this.data;

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

    const previousQuestionId = history[history.length - 1];
    this.setQuestion(previousQuestionId, history.slice(0, -1));
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
