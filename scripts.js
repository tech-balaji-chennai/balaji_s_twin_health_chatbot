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

    // Add action buttons
    const actionButtons = document.createElement('div');
    actionButtons.className = 'action-buttons';

    if (isUser) {
        // User messages get: Copy, Edit, Share, Download
        actionButtons.innerHTML = `
            <button onclick="copyText(this)" title="Copy message">📋</button>
            <button onclick="editText(this)" title="Edit message">✏️</button>
            <button onclick="shareText(this)" title="Share message">📤</button>
            <button onclick="downloadText(this)" title="Download message">💾</button>
        `;
    } else {
        // Bot messages get: Copy, Regenerate, Share, Download
        actionButtons.innerHTML = `
            <button onclick="copyText(this)" title="Copy response">📋</button>
            <button onclick="regenerateText(this)" title="Regenerate response">🔄</button>
            <button onclick="shareText(this)" title="Share response">📤</button>
            <button onclick="downloadText(this)" title="Download response">💾</button>
        `;
    }

    messageDiv.appendChild(actionButtons);

    // Insert before typing indicator
    chatMessages.insertBefore(messageDiv, typingIndicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    messageDiv.setAttribute("tabindex", "0");
    messageDiv.setAttribute(
        "aria-label",
        isUser ? "User message" : "Bot response"
    );
}

function showTypingIndicator() {
    typingIndicator.style.display = 'block';
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
    typingIndicator.style.display = 'none';
}

function defaultResponse() {
    return "I appreciate your question, but this topic is currently outside my knowledge scope. I specialize in information about Twin Health, diabetes reversal, metabolic health, and our Whole Body Digital Twin™ technology. Would you like to ask me something about Twin Health specifically?";
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
userInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Load KB on page load and focus input
window.addEventListener('load', async () => {
    await loadKnowledgeBase();
    userInput.focus();
});

// Action button functions
function getMessageText(btn) {
    const messageDiv = btn.closest('.message');
    const contentDiv = messageDiv.querySelector('.message-content');
    // Get text content, replacing <br> with newlines and removing suggestion buttons
    let clone = contentDiv.cloneNode(true);
    // Remove suggestions div if present
    const suggestions = clone.querySelector('.suggestions');
    if (suggestions) {
        suggestions.remove();
    }
    return clone.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
}

function getUserQuery(btn) {
    // Get the user message that triggered this bot response
    const botMessageDiv = btn.closest('.message.bot');
    let prevElement = botMessageDiv.previousElementSibling;
    
    // Skip typing indicator if present
    while (prevElement && prevElement.classList.contains('typing-indicator')) {
        prevElement = prevElement.previousElementSibling;
    }
    
    // Find the previous user message
    while (prevElement && !prevElement.classList.contains('user')) {
        prevElement = prevElement.previousElementSibling;
    }
    
    if (prevElement && prevElement.classList.contains('user')) {
        const contentDiv = prevElement.querySelector('.message-content');
        return contentDiv.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
    }
    
    return null;
}

function copyText(btn) {
    const text = getMessageText(btn);
    navigator.clipboard.writeText(text).then(() => {
        // Visual feedback
        const originalText = btn.innerHTML;
        btn.innerHTML = '✓ Copied!';
        btn.style.background = '#4caf50';
        btn.style.color = 'white';
        btn.style.borderColor = '#4caf50';
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = '';
            btn.style.color = '';
            btn.style.borderColor = '';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy text to clipboard');
    });
}

function downloadText(btn) {
    const text = getMessageText(btn);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `twin-health-chat-${timestamp}.txt`;
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Visual feedback
    const originalText = btn.innerHTML;
    btn.innerHTML = '✓ Downloaded!';
    btn.style.background = '#4caf50';
    btn.style.color = 'white';
    btn.style.borderColor = '#4caf50';
    
    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = '';
        btn.style.color = '';
        btn.style.borderColor = '';
    }, 2000);
}

function shareText(btn) {
    const text = getMessageText(btn);
    
    if (navigator.share) {
        navigator.share({
            title: 'Twin Health Chat',
            text: text
        }).then(() => {
            console.log('Successfully shared');
        }).catch(err => {
            console.error('Error sharing:', err);
        });
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(text).then(() => {
            alert('Sharing not supported on this browser. Text copied to clipboard instead!');
        }).catch(err => {
            alert('Sharing not supported on this browser');
        });
    }
}

function editText(btn) {
    const text = getMessageText(btn);
    userInput.value = text;
    userInput.focus();
    
    // Scroll to input
    userInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function regenerateText(btn) {
    const userQuery = getUserQuery(btn);
    if (userQuery) {
        userInput.value = userQuery;
        sendMessage();
    } else {
        alert('Could not find the original question to regenerate response.');
    }
}

function scrollChat(direction) {
    const scrollAmount = 300;
    chatMessages.scrollBy({
        top: direction === 'up' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
    });
}
