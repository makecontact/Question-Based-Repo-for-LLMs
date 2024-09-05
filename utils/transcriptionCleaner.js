require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function cleanTranscription(question, rawTranscription) {
  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 4000,
      system: `You are an expert transcription editor. Your task is to clean up the given transcription while preserving its nuance, message, and the exact way it was said, providing a clearer answer to the question being asked. Remove filler words, stutters, and irrelevant noises, but maintain the speaker's tone and intent, espcially if they go off topic add more value. Only make changes if they significantly improve clarity without altering the meaning, or if the question is expecting a single basic answer, in which case you can clean it up. Respond only with the cleaned up version of the transcript, and nothing else.`,
      messages: [
        {
          role: "user",
          content: `Question: ${question}\n\nRaw Transcription: ${rawTranscription}\n\nPlease provide only cleaned-up version of this transcription.`
        }
      ]
    });

    return response.content[0].text;
  } catch (error) {
    console.error('Error cleaning transcription:', error);
    return rawTranscription; // Return the original transcription if cleaning fails
  }
}

module.exports = { cleanTranscription };