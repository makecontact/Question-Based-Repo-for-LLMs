const fs = require('fs').promises;
const path = require('path');

const questionsFilePath = path.join(__dirname, '..', 'questions.json');

const defaultQuestions = {
  topics: [
    {
      topic: "Sample Topic",
      questions: [
        "Sample Question 1",
        "Sample Question 2"
      ]
    }
  ]
};

class Question {

  static async getAll() {
    try {
      const data = await fs.readFile(questionsFilePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('questions.json not found. Creating with default structure.');
        await this.saveAll(defaultQuestions);
        return defaultQuestions;
      } else {
        console.error('Error reading questions file:', error);
        throw error;
      }
    }
  }

  static async saveAll(questions) {
    try {
      await fs.writeFile(questionsFilePath, JSON.stringify(questions, null, 2));
    } catch (error) {
      console.error('Error writing questions file:', error);
      throw error;
    }
  }

  static async getFirstUnansweredId() {
    try {
      const questions = await this.getAll(); // This will create the file if it doesn't exist
      let questionIndex = 0;
      for (const topic of questions.topics) {
        for (const question of topic.questions) {
          questionIndex++;
          const audioPath = path.join(__dirname, '..', 'audio_files', `${questionIndex}.m4a`);
          try {
            await fs.access(audioPath, fs.constants.F_OK);
          } catch (error) {
            // File doesn't exist, this is the first unanswered question
            return questionIndex;
          }
        }
      }
      // If all questions are answered, return the last question's ID
      return questionIndex || 1; // Return 1 if there are no questions
    } catch (error) {
      console.error('Error finding first unanswered question:', error);
      return 1; // Return 1 as a default if there's an error
    }
  }

  static async getById(id) {
    const data = await fs.readFile(questionsFilePath, 'utf-8');
    const topics = JSON.parse(data).topics;
    
    let questionIndex = 0;
    for (const topic of topics) {
      for (const question of topic.questions) {
        questionIndex++;
        if (questionIndex === parseInt(id)) {
          return {
            id: questionIndex,
            text: question,
            topic: topic.topic
          };
        }
      }
    }
    throw new Error('Question not found');
  }

  static async saveTranscription(id, transcription) {
    const question = await this.getById(id);
    const transcriptionContent = `<topic><question>${question.text}</question><answer>${transcription}</answer></topic>`;
    await fs.writeFile(path.join(__dirname, '..', 'transcriptions', `${id}.txt`), transcriptionContent);
  }

  static async deleteAudioAndTranscription(id) {
    try {
      await fs.unlink(path.join(__dirname, '..', 'audio_files', `${id}.m4a`));
    } catch (error) {
      console.error('Failed to delete audio file:', error);
    }

    try {
      await fs.unlink(path.join(__dirname, '..', 'transcriptions', `${id}.txt`));
    } catch (error) {
      console.error('Failed to delete transcription file:', error);
    }
  }

  static async getAllTranscriptions() {
    const transcriptionFiles = await fs.readdir(path.join(__dirname, '..', 'transcriptions'));
    const transcriptions = await Promise.all(
      transcriptionFiles.map(async (file) => {
        const content = await fs.readFile(path.join(__dirname, '..', 'transcriptions', file), 'utf-8');
        return content;
      })
    );
    return transcriptions.join('\n');
  }
}

module.exports = Question;