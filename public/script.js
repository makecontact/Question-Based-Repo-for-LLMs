let currentQuestionId = 1;
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

const recordingStatus = document.createElement('div');
recordingStatus.className = 'mt-2 text-muted';
recordBtn.parentNode.insertBefore(recordingStatus, recordBtn.nextSibling);

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
    recordBtn.classList.add('btn-danger');
    recordBtn.textContent = 'Recording...';
    stopBtn.disabled = false;
  });

  mediaRecorder.addEventListener('stop', async () => {
    recordingStatus.textContent = 'Processing...';
    recordBtn.classList.remove('btn-danger');
    recordBtn.textContent = 'Record';
    recordBtn.disabled = true;
    stopBtn.disabled = true;

    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
    const formData = new FormData();
    formData.append('audio', audioBlob, `${currentQuestionId}.wav`);

    try {
      const response = await fetch(`/api/audio/${currentQuestionId}`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('Audio uploaded successfully');
      recordingStatus.textContent = 'Audio uploaded successfully';
    } catch (error) {
      console.error('Error uploading audio:', error);
      recordingStatus.textContent = 'Error uploading audio';
    } finally {
      audioChunks = [];
      updateAudioPlayer();
      recordBtn.disabled = false;
    }
  });
}

async function loadFirstUnansweredQuestion() {
  try {
    const response = await fetch('/api/first-unanswered');
    const { id } = await response.json();
    await loadQuestion(id);
  } catch (error) {
    console.error('Error loading first unanswered question:', error);
    questionText.textContent = 'Error loading question';
    topicText.textContent = '';
  }
}

async function loadQuestion(id) {
  try {
    const response = await fetch(`/api/question/${id}`);
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
  try {
    const response = await fetch(`/api/transcription/${id}`);
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
  try {
    const audioResponse = await fetch(`/api/audio-details/${currentQuestionId}`);
    const audioDetails = await audioResponse.json();

    if (audioDetails.exists) {
      console.log('Audio file details:', audioDetails);
      const audioFile = `/audio_files/${currentQuestionId}.m4a`;
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
    const transcriptionResponse = await fetch(`/api/transcription/${currentQuestionId}`);
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
  try {
    recordingStatus.textContent = 'Initializing...';
    recordBtn.disabled = true;
    
    // Check if there's an existing recording
    const response = await fetch(`/api/audio-exists/${currentQuestionId}`);
    const { exists } = await response.json();
    
    if (exists) {
      // Delete the existing recording
      await fetch(`/api/audio/${currentQuestionId}`, { method: 'DELETE' });
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
  await fetch(`/api/audio/${currentQuestionId}`, { method: 'DELETE' });
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
  try {
    const response = await fetch('/api/download-all-transcriptions');
    if (!response.ok) {
      throw new Error('Failed to download transcriptions');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'all_transcriptions.txt';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading all transcriptions:', error);
    alert('Failed to download all transcriptions. Please try again.');
  }
});


//loadQuestion(1);
loadFirstUnansweredQuestion();

// Initialize media recorder when the page loads
initializeMediaRecorder().catch(console.error);

// Add event listener for page reload
window.addEventListener('load', loadFirstUnansweredQuestion);