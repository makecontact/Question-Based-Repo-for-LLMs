const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs').promises;
const Question = require('../models/question');
const { transcribeAudio } = require('../utils/transcription');
const { cleanTranscription } = require('../utils/transcriptionCleaner');

// Helper function to create directory if it doesn't exist
async function ensureDir(dirPath) {
  try {
    await fs.access(dirPath);
  } catch (error) {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const setPath = path.join(__dirname, '..', 'question_sets', req.params.setName, 'audio_files');
    cb(null, setPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${req.params.id}_temp.wav`);
  }
});

const upload = multer({ storage: storage });

router.get('/questions/:setName', async (req, res) => {
  try {
    const questions = await Question.getAll(req.params.setName);
    res.json(questions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

router.post('/questions/:setName', async (req, res) => {
  try {
    await Question.saveAll(req.params.setName, req.body);
    res.json({ message: 'Questions updated successfully' });
  } catch (error) {
    console.error('Error updating questions:', error);
    res.status(500).json({ error: 'Failed to update questions' });
  }
});

router.get('/question/:setName/:id', async (req, res) => {
  try {
    const question = await Question.getById(req.params.setName, req.params.id);
    res.json(question);
  } catch (error) {
    res.status(404).json({ error: 'Question not found' });
  }
});

router.get('/audio-exists/:setName/:id', async (req, res) => {
  const audioPath = path.join(__dirname, '..', 'question_sets', req.params.setName, 'audio_files', `${req.params.id}.m4a`);
  try {
    await fs.access(audioPath, fs.constants.F_OK);
    res.json({ exists: true });
  } catch (error) {
    res.json({ exists: false });
  }
});

router.get('/audio-details/:setName/:id', async (req, res) => {
  const audioPath = path.join(__dirname, '..', 'question_sets', req.params.setName, 'audio_files', `${req.params.id}.m4a`);
  try {
    const stats = await fs.stat(audioPath);
    res.json({
      exists: true,
      size: stats.size,
      permissions: stats.mode.toString(8).slice(-3)
    });
  } catch (error) {
    res.json({ exists: false, error: error.message });
  }
});

router.delete('/audio/:setName/:id', async (req, res) => {
  try {
    await Question.deleteAudioAndTranscription(req.params.setName, req.params.id);
    res.json({ message: 'Existing audio and transcription deleted successfully' });
  } catch (error) {
    console.error('Error deleting existing audio and transcription:', error);
    res.status(500).json({ error: 'Failed to delete existing audio and transcription' });
  }
});

router.post('/audio/:setName/:id', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }
    const tempWavPath = req.file.path;
    const m4aPath = path.join(__dirname, '..', 'question_sets', req.params.setName, 'audio_files', `${req.params.id}.m4a`);

    // Check if the file is empty
    const stats = await fs.stat(tempWavPath);
    if (stats.size === 0) {
      await fs.unlink(tempWavPath); // Delete the empty file
      return res.status(400).json({ error: 'Uploaded file is empty' });
    }

    // Convert WAV to M4A using FFmpeg
    const ffmpegCommand = `ffmpeg -i "${tempWavPath}" -ar 16000 -ac 1 -map 0:a: "${m4aPath}"`;
    await execPromise(ffmpegCommand);

    // Delete the temporary WAV file
    await fs.unlink(tempWavPath);

    // Ensure the M4A file has the correct permissions
    await fs.chmod(m4aPath, 0o644);

    const rawTranscription = await transcribeAudio(m4aPath);
    const question = await Question.getById(req.params.setName, req.params.id);
    const cleanedTranscription = await cleanTranscription(question.text, rawTranscription);

    await Question.saveTranscription(req.params.setName, req.params.id, cleanedTranscription);
    res.json({ message: 'Audio uploaded, converted, transcribed, and cleaned successfully' });
  } catch (error) {
    console.error('Error processing audio:', error);
    res.status(500).json({ error: 'Failed to process audio', details: error.message });
  }
});

router.get('/first-unanswered/:setName', async (req, res) => {
  try {
    const firstUnansweredId = await Question.getFirstUnansweredId(req.params.setName);
    res.json({ id: firstUnansweredId });
  } catch (error) {
    console.error('Error finding first unanswered question:', error);
    res.status(500).json({ error: 'Failed to find first unanswered question', id: 1 });
  }
});

router.get('/download-all-transcriptions/:setName', async (req, res) => {
  try {
    const transcriptionsDir = path.join(__dirname, '..', 'question_sets', req.params.setName, 'transcriptions');
    const files = await fs.readdir(transcriptionsDir);
    
    // Filter out .DS_Store and other hidden files
    const visibleFiles = files.filter(file => !file.startsWith('.') && file.endsWith('.txt'));
    
    visibleFiles.sort((a, b) => parseInt(a.split('.')[0]) - parseInt(b.split('.')[0]));

    let allTranscriptions = '';
    for (const file of visibleFiles) {
      const filePath = path.join(transcriptionsDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Ensure the content starts with '<topic>'
      const topicStart = content.indexOf('<topic>');
      if (topicStart !== -1) {
        allTranscriptions += content.slice(topicStart) + '\n';
      } else {
        console.warn(`File ${file} does not contain expected '<topic>' tag`);
      }
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${req.params.setName}_all_transcriptions.txt`);
    res.send(allTranscriptions);
  } catch (error) {
    console.error('Error downloading all transcriptions:', error);
    res.status(500).json({ error: 'Failed to download all transcriptions' });
  }
});

router.get('/transcription/:setName/:id', async (req, res) => {
  try {
    const transcriptionPath = path.join(__dirname, '..', 'question_sets', req.params.setName, 'transcriptions', `${req.params.id}.txt`);
    const transcription = await fs.readFile(transcriptionPath, 'utf-8');
    res.json({ transcription });
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.json({ transcription: '' }); // No transcription file found
    } else {
      console.error('Error fetching transcription:', error);
      res.status(500).json({ error: 'Failed to fetch transcription' });
    }
  }
});

router.get('/transcriptions/:setName', async (req, res) => {
  try {
    const transcriptions = await Question.getAllTranscriptions(req.params.setName);
    res.json(transcriptions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transcriptions' });
  }
});

router.post('/question-sets', async (req, res) => {
  try {
    const { setName } = req.body;
    if (!setName) {
      return res.status(400).json({ error: 'Set name is required' });
    }

    const setPath = path.join(__dirname, '..', 'question_sets', setName);
    await ensureDir(setPath);
    await ensureDir(path.join(setPath, 'audio_files'));
    await ensureDir(path.join(setPath, 'transcriptions'));

    // Create a questions.json file with an example topic and question
    const exampleQuestions = {
      topics: [
        {
          topic: "Example Topic",
          questions: [
            "This is an example question?"
          ]
        }
      ]
    };
    await fs.writeFile(path.join(setPath, 'questions.json'), JSON.stringify(exampleQuestions, null, 2));

    res.json({ message: 'Question set created successfully' });
  } catch (error) {
    console.error('Error creating question set:', error);
    res.status(500).json({ error: 'Failed to create question set' });
  }
});

router.delete('/question-sets/:setName', async (req, res) => {
  try {
    const setPath = path.join(__dirname, '..', 'question_sets', req.params.setName);
    await fs.rm(setPath, { recursive: true, force: true });
    res.json({ message: 'Question set deleted successfully' });
  } catch (error) {
    console.error('Error deleting question set:', error);
    res.status(500).json({ error: 'Failed to delete question set' });
  }
});

module.exports = router;
