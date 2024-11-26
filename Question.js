const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  anticipatedAnswer: { type: String, required: true },
  ChatGPT_response: { type: String }, // ChatGPT's response
  isAccurate: { type: Boolean }, // Accuracy of the response
  responseTime: { type: Number }, // Response time in milliseconds
});

module.exports = mongoose.model('Question', QuestionSchema);
