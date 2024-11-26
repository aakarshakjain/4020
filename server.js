const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');

// MongoDB connection string
const MONGO_URI = 'mongodb+srv://aakarshak27:ioH5ylATOmBMWK4I@cluster0.7zlpg.mongodb.net/ChatGPT_Evaluation?retryWrites=true&w=majority';

// OpenAI ChatGPT API key
const CHATGPT_API_KEY = process.env.CHATGPT_API_KEY || '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';

// Initialize Express
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Home Route
app.get("/", (req, res) => {
    res.send("Welcome to the ChatGPT Evolution API!");
});

// Connect to MongoDB
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected to ChatGPT_Evaluation'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Schema and Models
const Question = require('./Question');

// Route: Retrieve a random question from a specified topic
app.get('/random-question/:topic', async (req, res) => {
  const { topic } = req.params;
  try {
    const Collection = mongoose.model(topic, Question.schema, topic);
    const count = await Collection.countDocuments();
    if (count === 0) {
      return res.status(404).json({ error: 'No questions available in this topic.' });
    }
    const randomIndex = Math.floor(Math.random() * count);
    const question = await Collection.findOne().skip(randomIndex);
    res.json(question);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route: Send question to ChatGPT and store the response
app.post('/answer-question/:topic/:id', async (req, res) => {
  const { topic, id } = req.params;

  try {
    const Collection = mongoose.model(topic, Question.schema, topic);

    // Fetch the question document by ID
    const question = await Collection.findById(id);
    if (!question) {
      return res.status(404).json({ error: 'Question not found.' });
    }

    const startTime = Date.now(); // Start measuring response time

    // Send question to ChatGPT API
    const chatgptResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: question.question }],
        max_tokens: 500,
        temperature: 0.7,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CHATGPT_API_KEY}`,
        },
      }
    );

    const endTime = Date.now(); // Stop measuring response time

    // Extract response from ChatGPT
    const assistantReply = chatgptResponse.data.choices[0].message.content.trim();

    // Compare ChatGPT's response with the anticipated answer
    const isAccurate = assistantReply.toLowerCase().includes(question.anticipatedAnswer.toLowerCase());

    // Save ChatGPT's response, accuracy, and response time in the document
    question.ChatGPT_response = assistantReply;
    question.isAccurate = isAccurate; // Boolean: true if accurate, false otherwise
    question.responseTime = endTime - startTime; // Time in milliseconds
    await question.save();

    res.json({
      success: true,
      question,
      responseTime: question.responseTime,
      isAccurate: question.isAccurate,
    });
  } catch (err) {
    console.error('Error in /answer-question/:topic/:id:', err.message);
    res.status(500).json({ error: 'Failed to send question to ChatGPT.' });
  }
});


app.get('/visualization-data', async (req, res) => {
  try {
    const domains = ['History', 'Social_Science', 'Computer_Security'];
    const results = {};

    for (const domain of domains) {
      const Collection = mongoose.model(domain, Question.schema, domain);

      // Aggregate data
      const data = await Collection.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            accurate: { $sum: { $cond: ['$isAccurate', 1, 0] } },
            avgResponseTime: { $avg: '$responseTime' },
          },
        },
      ]);

      if (data.length > 0) {
        const { total, accurate, avgResponseTime } = data[0];
        results[domain] = {
          accuracyRate: total > 0 ? ((accurate / total) * 100).toFixed(2) : '0.00',
          avgResponseTime: avgResponseTime ? avgResponseTime.toFixed(2) : '0.00',
        };
      } else {
        results[domain] = {
          accuracyRate: '0.00',
          avgResponseTime: '0.00',
        };
      }
    }

    res.json(results);
  } catch (err) {
    console.error('Error fetching visualization data:', err.message);
    res.status(500).json({ error: 'Failed to fetch visualization data.' });
  }
});


// Start Server
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
