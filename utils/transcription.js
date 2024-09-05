const fs = require('fs');
const Groq = require('groq-sdk');

const groq = new Groq();

async function transcribeAudio(audioPath) {
  try {
    // Check if the file exists and is not empty
    const stats = await fs.promises.stat(audioPath);
    if (stats.size === 0) {
      throw new Error('Audio file is empty');
    }

    const translation = await groq.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: "distil-whisper-large-v3-en",
      response_format: "verbose_json"
    });

    if (!translation || !translation.text) {
      throw new Error('Transcription failed: No text returned');
    }

    return translation.text;
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw error;
  }
}

module.exports = { transcribeAudio };