require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs').promises;
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static('public'));

// Serve audio files from the question_sets directory
app.use('/question_sets', express.static(path.join(__dirname, 'question_sets')));

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/questions-editor', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'questions-editor.html'));
});

// Add a new route to get available question sets
app.get('/api/question-sets', async (req, res) => {
  try {
    const questionSetsDir = path.join(__dirname, 'question_sets');
    const sets = await fs.readdir(questionSetsDir);
    const validSets = await Promise.all(sets.map(async (set) => {
      const questionsPath = path.join(questionSetsDir, set, 'questions.json');
      try {
        await fs.access(questionsPath, fs.constants.F_OK);
        return set;
      } catch {
        return null;
      }
    }));
    res.json(validSets.filter(set => set !== null));
  } catch (error) {
    console.error('Error fetching question sets:', error);
    res.status(500).json({ error: 'Failed to fetch question sets' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
