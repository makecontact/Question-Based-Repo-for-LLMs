let editor;
let currentSetName = '';

document.addEventListener('DOMContentLoaded', async function() {
    const container = document.getElementById('editor');
    const options = {
        modes: ['tree', 'form', 'code'],
        mode: 'tree',
        schema: {
            type: "object",
            properties: {
                topics: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            topic: { type: "string" },
                            questions: {
                                type: "array",
                                items: { type: "string" }
                            }
                        }
                    }
                }
            }
        },
        onError: function(err) {
            alert(err.toString());
        },
        onModeChange: function(newMode, oldMode) {
            console.log('Mode switched from', oldMode, 'to', newMode);
        }
    };
    editor = new JSONEditor(container, options);

    await loadQuestionSets();
    document.getElementById('setSelector').addEventListener('change', loadQuestions);
    document.getElementById('saveButton').addEventListener('click', saveQuestions);
    document.getElementById('createSetBtn').addEventListener('click', createNewSet);
    document.getElementById('cloneSetBtn').addEventListener('click', cloneSet);
    document.getElementById('deleteSetBtn').addEventListener('click', deleteSet);
});

async function loadQuestionSets() {
    try {
        const response = await fetch('/api/question-sets');
        const sets = await response.json();
        const setSelector = document.getElementById('setSelector');
        setSelector.innerHTML = '<option value="">Select a question set</option>' +
            sets.map(set => `<option value="${set}">${set}</option>`).join('');
    } catch (error) {
        console.error('Error loading question sets:', error);
        alert('Failed to load question sets. Please try again.');
    }
}

async function cloneSet() {
    if (!currentSetName) {
        alert('Please select a question set to clone.');
        return;
    }

    const newSetName = prompt(`Enter a name for the cloned set of "${currentSetName}":`);
    if (!newSetName) return;

    try {
        const response = await fetch(`/api/question-sets/${currentSetName}/clone`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ newSetName }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        alert('Question set cloned successfully!');
        await loadQuestionSets();
    } catch (error) {
        console.error('Error cloning question set:', error);
        alert('Failed to clone question set. Please try again.');
    }
}

async function loadQuestions() {
    currentSetName = document.getElementById('setSelector').value;
    if (!currentSetName) {
        editor.set({topics: []});
        return;
    }

    try {
        const response = await fetch(`/api/questions/${currentSetName}`);
        const questions = await response.json();
        editor.set(questions);
    } catch (error) {
        console.error('Error loading questions:', error);
        alert('Failed to load questions. Please try again.');
    }
}

async function saveQuestions() {
    if (!currentSetName) {
        alert('Please select a question set first.');
        return;
    }

    try {
        const updatedQuestions = editor.get();
        const response = await fetch(`/api/questions/${currentSetName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updatedQuestions),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        alert('Questions saved successfully!');
    } catch (error) {
        console.error('Error saving questions:', error);
        alert('Failed to save questions. Please try again.');
    }
}

async function createNewSet() {
    const setName = prompt('Enter the name for the new question set:');
    if (!setName) return;

    try {
        const response = await fetch('/api/question-sets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ setName }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        alert('New question set created successfully!');
        await loadQuestionSets();
    } catch (error) {
        console.error('Error creating new question set:', error);
        alert('Failed to create new question set. Please try again.');
    }
}

async function deleteSet() {
    if (!currentSetName) {
        alert('Please select a question set first.');
        return;
    }

    if (!confirm(`Are you sure you want to delete the question set "${currentSetName}"? This action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/question-sets/${currentSetName}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        alert('Question set deleted successfully!');
        currentSetName = '';
        editor.set({topics: []});
        await loadQuestionSets();
    } catch (error) {
        console.error('Error deleting question set:', error);
        alert('Failed to delete question set. Please try again.');
    }
}
