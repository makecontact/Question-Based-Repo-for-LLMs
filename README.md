# Question Repo Builder

This application allows users to record audio responses to a series of questions, transcribe the audio, and compile all transcriptions into a single document. It's built with Node.js, Express, and uses the Groq API for transcription and the Anthropic API for transcription cleaning.

## Setup

1. Clone the repository:
   ```
   git clone https://github.com/makecontact/Question-Based-Repo-for-LLMs.git
   cd Question-Based-Repo-for-LLMs
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory with the following content:
   ```
   GROQ_API_KEY=your_groq_api_key_here
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   ```

4. Create a `questions.json` file in the root directory with the following structure:
   ```json
   {
     "topics": [
       {
         "topic": "Basic facts",
         "questions": [
           "Full name",
           "Date of birth",
           "Place of birth",
           "Current residence",
           "Nationality",
           "Languages spoken"
         ]
       },
       {
         "topic": "Another topic",
         "questions": [
           "Question 1",
           "Question 2"
         ]
       }
     ]
   }
   ```

5. Create the following directories in the root of the project:
   ```
   mkdir audio_files transcriptions
   ```

## Running the Application

1. Start the server:
   ```
   node app.js
   ```

2. Open a web browser and navigate to `http://localhost:3000`

## Usage

- Navigate through questions using the "Previous" and "Next" buttons.
- Click "Record" to start recording your answer.
- Click "Stop" to end the recording.
- The audio will be automatically transcribed and cleaned.
- Use the "Download All Transcriptions" button to get a compiled document of all answers.

## Project Structure

- `app.js`: Main application file
- `routes/api.js`: API routes
- `models/question.js`: Question model
- `utils/transcription.js`: Audio transcription utility
- `utils/transcriptionCleaner.js`: Transcription cleaning utility
- `public/`: Frontend files (HTML, CSS, JavaScript)
- `audio_files/`: Directory for storing audio recordings
- `transcriptions/`: Directory for storing transcriptions

## Features

- Record audio responses to predefined questions
- Automatic transcription and cleaning of audio responses
- Compile all transcriptions into a single document
- Built-in Questions Editor for managing the question set
  - Access the Questions Editor by clicking "Questions Editor" in the top navigation menu
  - Add, remove, or modify topics and questions
  - Changes are saved directly to the questions.json file

## Dependencies

- Express
- Multer
- Groq SDK
- Anthropic SDK
- dotenv

## Note

This application is designed for local use and may require additional security measures for production deployment.