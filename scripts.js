// Load knowledge base from knowledge_base.json and provide simple matching

let kbEntries = [];
let kbLoaded = false;

const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const typingIndicator = document.getElementById('typingIndicator');

async function loadKnowledgeBase() {
    try {
        const resp = await fetch('knowledge_base.json', {cache: "no-store"});
        if (!resp.ok) throw new Error('Failed to fetch knowledge_base.json: ' + resp.status);
        const data = await resp.json();
        kbEntries = Array.isArray(data.entries) ? data.entries : [];
        kbLoaded = true;
        console.log('Knowledge base loaded, entries:', kbEntries.length);
    } catch (err) {
        kbLoaded = false;
        console.error('Error loading knowledge base:', err);
    }
}

function tokenize(text) {
    return (text || '').toLowerCase().match(/\b[a-z0-9]+(?:'[a-z0-9]+)?\b/g) || [];
}

function findBestMatch(userMessage) {
    const message = (userMessage || '').toLowerCase().trim();
    if (!message || !kbLoaded || kbEntries.length === 0) {
        return null;
    }

    const msgTokens = tokenize(message);
    let best = null;
    let bestScore = 0;

    for (const entry of kbEntries) {
        let score = 0;
        const q = (entry.question || '').toLowerCase();
        const tags = (entry.tags || []).map(t => t.toLowerCase());

        // Strong match if the whole message is a substring of the question
        if (q.includes(message) && message.length > 3) score += 5;

        // Tag matches
        for (const tag of tags) {
            if (message.includes(tag)) score += 2;
        }

        // Token overlap with question
        const qTokens = tokenize(q);
        for (const t of msgTokens) {
            if (qTokens.includes(t)) score += 0.7;
        }

        // Small boost for title length / authoritative source
        if (entry.source) score += 0.1;

        if (score > bestScore) {
            bestScore = score;
            best = entry;
        }
    }

    // Threshold to avoid weak matches
    if (bestScore >= 1.0 && best) {
        const meta = `\n\nSource: ${best.source || 'unknown'} (updated ${best.last_updated || 'unknown'})`;
        return `${best.answer}${meta}`;
    }

    return null;
}

function addMessage(message, isUser) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = message.replace(/\n/g, '<br>');

    messageDiv.appendChild(contentDiv);

    // Insert before typing indicator
    chatMessages.insertBefore(messageDiv, typingIndicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
    typingIndicator.style.display = 'block';
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
    typingIndicator.style.display = 'none';
}

function defaultResponse() {
    return "I appreciate your question, but this topic is currently outside my knowledge scope. I specialize in information about Twin Health, twin pregnancy, postpartum care, and newborn guidance. Would you like resources or to rephrase the question?";
}

function sendMessage() {
    const message = userInput.value.trim();
    if (message === '') return;

    addMessage(message, true);
    userInput.value = '';

    showTypingIndicator();

    setTimeout(() => {
        if (!kbLoaded) {
            hideTypingIndicator();
            addMessage("Knowledge base not loaded. Please ensure knowledge_base.json is in the same folder and you're serving the site from a web server (not file://).", false);
            return;
        }

        const response = findBestMatch(message) || defaultResponse();
        hideTypingIndicator();
        addMessage(response, false);
    }, 400 + Math.random() * 900);
}

function sendSuggestion(suggestion) {
    userInput.value = suggestion;
    sendMessage();
}

// Enter key to send
userInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Load KB on page load and focus input
window.addEventListener('load', async () => {
    await loadKnowledgeBase();
    userInput.focus();
});
