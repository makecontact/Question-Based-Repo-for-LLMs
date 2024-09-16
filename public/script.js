let currentQuestionId = 1;
let currentSetName = '';
let mediaRecorder;
let audioChunks = [];
let stream;

const questionText = document.getElementById('questionText');
const topicText = document.getElementById('topicText');
const recordBtn = document.getElementById('recordBtn');
const stopBtn = document.getElementById('stopBtn');
const deleteBtn = document.getElementById('deleteBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const audioContainer = document.getElementById('audioContainer');
const transcriptionContainer = document.getElementById('transcriptionContainer');
const recordingStatus = document.getElementById('recordingStatus');
const setSelector = document.getElementById('setSelector');

// Load available question sets
async function loadQuestionSets() {
  try {
    const response = await fetch('/api/question-sets');
    const sets = await response.json();
    setSelector.innerHTML = '<option value="">Select a question set</option>' +
      sets.map(set => `<option value="${set}">${set}</option>`).join('');
  } catch (error) {
    console.error('Error loading question sets:', error);
  }
}

setSelector.addEventListener('change', async (event) => {
  currentSetName = event.target.value;
  if (currentSetName) {
    await loadFirstUnansweredQuestion();
    await updateProgressBar();
  } else {
    resetUI();
    resetProgressBar();
  }
});

function resetUI() {
  questionText.textContent = 'Please select a question set';
  topicText.textContent = '';
  audioContainer.innerHTML = '';
  transcriptionContainer.textContent = '';
  disableRecordingControls();
  resetProgressBar();
}

async function initializeMediaRecorder() {
  if (!stream) {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  }
  mediaRecorder = new MediaRecorder(stream);
  
  mediaRecorder.addEventListener('dataavailable', event => {
      if (event.data.size > 0) {
          audioChunks.push(event.data);
      }
  });

  mediaRecorder.addEventListener('start', () => {
      recordingStatus.textContent = 'Recording...';
      recordBtn.disabled = true;
      stopBtn.disabled = false;
      deleteBtn.disabled = true;
  });

  mediaRecorder.addEventListener('stop', async () => {
      recordingStatus.textContent = 'Processing...';
      recordBtn.disabled = false;
      stopBtn.disabled = true;
      deleteBtn.disabled = true;

      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
      const formData = new FormData();
      formData.append('audio', audioBlob, `${currentQuestionId}.wav`);

      try {
          if (!currentSetName) {
              throw new Error('No question set selected');
          }
          const response = await fetch(`/api/audio/${currentSetName}/${currentQuestionId}`, {
              method: 'POST',
              body: formData
          });

          if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
          }

          console.log('Audio uploaded successfully');
          recordingStatus.textContent = 'Audio uploaded and processed successfully';
      } catch (error) {
          console.error('Error uploading audio:', error);
          recordingStatus.textContent = 'Error uploading audio: ' + error.message;
      } finally {
          audioChunks = [];
          await updateAudioPlayer();
          await updateProgressBar();
          recordBtn.disabled = false;
      }
  });
}

async function loadFirstUnansweredQuestion() {
  if (!currentSetName) {
    resetUI();
    return;
  }
  try {
    const response = await fetch(`/api/first-unanswered/${currentSetName}`);
    const { id } = await response.json();
    await loadQuestion(id);
  } catch (error) {
    console.error('Error loading first unanswered question:', error);
    questionText.textContent = 'No questions available. Please add questions in the Questions Editor.';
    topicText.textContent = '';
    disableRecordingControls();
  }
}

function disableRecordingControls() {
  recordBtn.disabled = true;
  stopBtn.disabled = true;
  deleteBtn.disabled = true;
  prevBtn.disabled = true;
  nextBtn.disabled = true;
}

async function loadQuestion(id) {
  if (!currentSetName) {
    resetUI();
    return;
  }
  try {
    const response = await fetch(`/api/question/${currentSetName}/${id}`);
    if (!response.ok) {
      throw new Error('Question not found');
    }
    const question = await response.json();
    questionText.textContent = question.text;
    topicText.textContent = `Topic: ${question.topic}`;
    currentQuestionId = id;
    await updateAudioPlayer();
    await loadTranscription(id);
  } catch (error) {
    console.error('Error loading question:', error);
    questionText.textContent = 'Error loading question';
    topicText.textContent = '';
    transcriptionContainer.textContent = '';
  }
}

async function loadTranscription(id) {
  if (!currentSetName) return;
  try {
    const response = await fetch(`/api/transcription/${currentSetName}/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch transcription');
    }
    const { transcription } = await response.json();
    transcriptionContainer.textContent = transcription || 'No transcription available.';
  } catch (error) {
    console.error('Error loading transcription:', error);
    transcriptionContainer.textContent = 'Error loading transcription.';
  }
}

async function updateAudioPlayer() {
  if (!currentSetName) {
    resetUI();
    return;
  }
  try {
    const audioResponse = await fetch(`/api/audio-details/${currentSetName}/${currentQuestionId}`);
    const audioDetails = await audioResponse.json();

    if (audioDetails.exists) {
      console.log('Audio file details:', audioDetails);
      const audioFile = `/question_sets/${currentSetName}/audio_files/${currentQuestionId}.m4a`;
      audioContainer.innerHTML = `
        <audio controls src="${audioFile}">
          Your browser does not support the audio element.
        </audio>
      `;
      const audioElement = audioContainer.querySelector('audio');
      audioElement.onerror = (e) => {
        console.error('Error loading audio:', e);
        audioContainer.innerHTML = `Error loading audio file. Details: ${JSON.stringify(audioDetails)}`;
      };
      deleteBtn.disabled = false;
    } else {
      audioContainer.innerHTML = 'No audio recording available.';
      deleteBtn.disabled = true;
    }

    // Load transcription
    const transcriptionResponse = await fetch(`/api/transcription/${currentSetName}/${currentQuestionId}`);
    if (transcriptionResponse.ok) {
      const { transcription } = await transcriptionResponse.json();
      transcriptionContainer.textContent = transcription || 'No transcription available.';
    } else {
      transcriptionContainer.textContent = 'Error loading transcription.';
    }

  } catch (error) {
    console.error('Error checking audio file or loading transcription:', error);
    audioContainer.innerHTML = 'Error checking audio file.';
    transcriptionContainer.textContent = 'Error loading transcription.';
    deleteBtn.disabled = true;
  }
}

recordBtn.addEventListener('click', async () => {
  if (!currentSetName) return;
  try {
    recordingStatus.textContent = 'Initializing...';
    recordBtn.disabled = true;
    
    // Check if there's an existing recording
    const response = await fetch(`/api/audio-exists/${currentSetName}/${currentQuestionId}`);
    const { exists } = await response.json();
    
    if (exists) {
      // Delete the existing recording
      await fetch(`/api/audio/${currentSetName}/${currentQuestionId}`, { method: 'DELETE' });
      console.log('Existing recording deleted');
    }

    if (!mediaRecorder) {
      await initializeMediaRecorder();
    }

    audioChunks = [];
    mediaRecorder.start();
  } catch (error) {
    console.error('Error starting recording:', error);
    recordingStatus.textContent = 'Error starting recording';
    recordBtn.disabled = false;
  }
});

stopBtn.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
});

deleteBtn.addEventListener('click', async () => {
  if (!currentSetName) return;
  await fetch(`/api/audio/${currentSetName}/${currentQuestionId}`, { method: 'DELETE' });
  updateAudioPlayer();
});

prevBtn.addEventListener('click', () => {
  if (currentQuestionId > 1) {
    loadQuestion(currentQuestionId - 1);
  }
});

nextBtn.addEventListener('click', () => {
  loadQuestion(currentQuestionId + 1);
});

downloadAllBtn.addEventListener('click', async () => {
  if (!currentSetName) return;
  try {
    const response = await fetch(`/api/download-all-transcriptions/${currentSetName}`);
    if (!response.ok) {
      throw new Error('Failed to download transcriptions');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `${currentSetName}_all_transcriptions.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading all transcriptions:', error);
    alert('Failed to download all transcriptions. Please try again.');
  }
});

async function updateProgressBar() {
  if (!currentSetName) {
    resetProgressBar();
    return;
  }
  try {
    const totalQuestions = await getTotalQuestions();
    const completedQuestions = await getCompletedQuestions();
    const remainingQuestions = Math.max(0, totalQuestions - completedQuestions);
    const progressPercentage = totalQuestions > 0 ? Math.min(100, Math.round((completedQuestions / totalQuestions) * 100)) : 0;
    
    const progressBar = document.getElementById('progressBar');
    progressBar.style.width = `${progressPercentage}%`;
    progressBar.setAttribute('aria-valuenow', progressPercentage);
    progressBar.textContent = `${progressPercentage}%`;

    const questionsRemainingElement = document.getElementById('questionsRemaining');
    questionsRemainingElement.textContent = `Questions remaining: ${remainingQuestions} out of ${totalQuestions}`;
  } catch (error) {
    console.error('Error updating progress bar:', error);
    resetProgressBar();
  }
}

function resetProgressBar() {
  const progressBar = document.getElementById('progressBar');
  progressBar.style.width = '0%';
  progressBar.setAttribute('aria-valuenow', 0);
  progressBar.textContent = '';

  const questionsRemainingElement = document.getElementById('questionsRemaining');
  questionsRemainingElement.textContent = '';
}

async function getTotalQuestions() {
  try {
    const response = await fetch(`/api/questions/${currentSetName}`);
    const data = await response.json();
    return data.topics.reduce((total, topic) => total + topic.questions.length, 0);
  } catch (error) {
    console.error('Error fetching total questions:', error);
    return 0;
  }
}

async function getCompletedQuestions() {
  try {
    const response = await fetch(`/api/transcriptions/${currentSetName}`);
    const transcriptions = await response.text();
    return (transcriptions.match(/<topic>/g) || []).length;
  } catch (error) {
    console.error('Error fetching completed questions:', error);
    return 0;
  }
}

// Load question sets when the page loads
loadQuestionSets();

// Initialize media recorder when the page loads
initializeMediaRecorder().catch(console.error);

// Add event listener for page reload
window.addEventListener('load', loadQuestionSets);
