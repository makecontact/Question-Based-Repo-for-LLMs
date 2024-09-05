let editor;

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

    try {
        const response = await fetch('/api/questions');
        const questions = await response.json();
        editor.set(questions);
    } catch (error) {
        console.error('Error loading questions:', error);
        alert('Failed to load questions. Please try again.');
    }

    document.getElementById('saveButton').addEventListener('click', saveQuestions);
});

async function saveQuestions() {
    try {
        const updatedQuestions = editor.get();
        const response = await fetch('/api/questions', {
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