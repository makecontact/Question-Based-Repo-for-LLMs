const fs = require('fs').promises;
const path = require('path');

const questionsFilePath = path.join(__dirname, '..', 'questions.json');

class Question {
  static async getAll() {
    const data = await fs.readFile(questionsFilePath, 'utf-8');
    return JSON.parse(data).topics;
  }

  static async getFirstUnansweredId() {
    const data = await fs.readFile(questionsFilePath, 'utf-8');
    const topics = JSON.parse(data).topics;
    
    let questionIndex = 0;
    for (const topic of topics) {
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
    return questionIndex;
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