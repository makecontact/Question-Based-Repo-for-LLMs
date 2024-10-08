const fs = require('fs').promises;
const path = require('path');

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
  static getSetPath(setName) {
    return path.join(__dirname, '..', 'question_sets', setName);
  }

  static async getAll(setName) {
    const questionsFilePath = path.join(this.getSetPath(setName), 'questions.json');
    try {
      const data = await fs.readFile(questionsFilePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`questions.json not found for set ${setName}. Creating with default structure.`);
        await this.saveAll(setName, defaultQuestions);
        return defaultQuestions;
      } else {
        console.error('Error reading questions file:', error);
        throw error;
      }
    }
  }

  static async saveAll(setName, questions) {
    const questionsFilePath = path.join(this.getSetPath(setName), 'questions.json');
    try {
      await fs.writeFile(questionsFilePath, JSON.stringify(questions, null, 2));
    } catch (error) {
      console.error('Error writing questions file:', error);
      throw error;
    }
  }

  static async getFirstUnansweredId(setName) {
    try {
      const questions = await this.getAll(setName);
      let questionIndex = 0;
      for (const topic of questions.topics) {
        for (const question of topic.questions) {
          questionIndex++;
          const audioPath = path.join(this.getSetPath(setName), 'audio_files', `${questionIndex}.m4a`);
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

  static async getById(setName, id) {
    const data = await fs.readFile(path.join(this.getSetPath(setName), 'questions.json'), 'utf-8');
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

  static async saveTranscription(setName, id, transcription) {
    const question = await this.getById(setName, id);
    const transcriptionContent = `<topic><question>${question.text}</question><answer>${transcription}</answer></topic>`;
    await fs.writeFile(path.join(this.getSetPath(setName), 'transcriptions', `${id}.txt`), transcriptionContent);
  }

  static async deleteAudioAndTranscription(setName, id) {
    try {
      await fs.unlink(path.join(this.getSetPath(setName), 'audio_files', `${id}.m4a`));
    } catch (error) {
      console.error('Failed to delete audio file:', error);
    }

    try {
      await fs.unlink(path.join(this.getSetPath(setName), 'transcriptions', `${id}.txt`));
    } catch (error) {
      console.error('Failed to delete transcription file:', error);
    }
  }

  static async getAllTranscriptions(setName) {
    const transcriptionFiles = await fs.readdir(path.join(this.getSetPath(setName), 'transcriptions'));
    const transcriptions = await Promise.all(
      transcriptionFiles.map(async (file) => {
        const content = await fs.readFile(path.join(this.getSetPath(setName), 'transcriptions', file), 'utf-8');
        return content;
      })
    );
    return transcriptions.join('\n');
  }

  static async cloneSet(sourceSetName, targetSetName) {
    const sourceSetPath = this.getSetPath(sourceSetName);
    const targetSetPath = this.getSetPath(targetSetName);

    // Create the new set directory
    await fs.mkdir(targetSetPath, { recursive: true });

    // Create subdirectories
    await fs.mkdir(path.join(targetSetPath, 'audio_files'), { recursive: true });
    await fs.mkdir(path.join(targetSetPath, 'transcriptions'), { recursive: true });

    // Copy questions.json
    const questionsFilePath = path.join(sourceSetPath, 'questions.json');
    const targetQuestionsFilePath = path.join(targetSetPath, 'questions.json');
    await fs.copyFile(questionsFilePath, targetQuestionsFilePath);
  }
}

module.exports = Question;
