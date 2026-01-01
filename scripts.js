/* ===============================
   GLOBAL STATE
   =============================== */
let chats = {};
let activeChatId = null;

let kbEntries = [];
let kbLoaded = false;

const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const typingIndicator = document.getElementById('typingIndicator');
const themeToggle = document.getElementById('themeToggle');
const tabsContainer = document.getElementById('tabsContainer');
const newTabBtn = document.getElementById('newTabBtn');
const deleteTabBtn = document.getElementById('deleteTabBtn');


/* ===============================
   STORAGE FUNCTIONS
   =============================== */
function loadFromStorage() {
    try {
        const storedChats = localStorage.getItem('twinHealthChats');
        const storedActiveId = localStorage.getItem('activeChatId');
        
        if (storedChats) {
            chats = JSON.parse(storedChats);
        }
        
        if (storedActiveId && chats[storedActiveId]) {
            activeChatId = storedActiveId;
        }
    } catch (err) {
        console.error('Error loading from storage:', err);
        chats = {};
        activeChatId = null;
    }
}

function saveToStorage() {
    try {
        localStorage.setItem('twinHealthChats', JSON.stringify(chats));
        if (activeChatId) {
            localStorage.setItem('activeChatId', activeChatId);
        }
    } catch (err) {
        console.error('Error saving to storage:', err);
    }
}


/* ===============================
   DARK MODE
   =============================== */
function toggleDarkMode() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeToggle.textContent = isDark ? '☀️' : '🌙';
    themeToggle.setAttribute('data-tooltip', isDark ? 'Toggle light mode' : 'Toggle dark mode');
}

/* ===============================
   KNOWLEDGE BASE
   =============================== */
async function loadKnowledgeBase() {
    try {
        const response = await fetch('knowledge_base.json');
        const data = await response.json();
        kbEntries = Array.isArray(data.entries) ? data.entries : [];
        kbLoaded = true;
    } catch (err) {
        kbLoaded = false;
        console.error('KB load failed', err);
    }
}

function tokenize(text) {
    return (text || '').toLowerCase().match(/\b[a-z0-9]+\b/g) || [];
}

function findBestMatch(userMessage) {
    if (!kbLoaded || !userMessage) return null;

    const msgTokens = tokenize(userMessage);
    let best = null;
    let bestScore = 0;

    for (const entry of kbEntries) {
        let score = 0;
        const qTokens = tokenize(entry.question);
        const aTokens = tokenize(entry.answer);
        const tagTokens = (entry.tags || []).flatMap(t => tokenize(t));
        const categoryTokens = tokenize(entry.category || '');

        for (const t of msgTokens) {
            if (qTokens.includes(t)) score += 3;       // Highest weight for question match
            if (aTokens.includes(t)) score += 1;       // Medium weight for answer match
            if (tagTokens.includes(t)) score += 2;     // High weight for tags
            if (categoryTokens.includes(t)) score += 2; // High weight for category
        }

        if (score > bestScore) {
            bestScore = score;
            best = entry;
        }
    }

    if (bestScore >= 1 && best) {
        return `${best.answer}\n\n<em>Source: ${best.source || 'Twin Health'}</em>`;
    }
    return null;
}

/* ===============================
   MULTI-TAB CHAT MANAGEMENT
   =============================== */
const initialBotMessage = {
    text: `Hello! I'm your Twin Health assistant. I can help you learn about reversing diabetes naturally using our Whole Body Digital Twin technology. How can I assist you now?`,
    user: false,
    isWelcome: true
};

function createNewChat() {
    const id = 'chat_' + Date.now();
    chats[id] = [{
        text: initialBotMessage.text,
        user: false,
        isWelcome: true
    }];
    // Set default name for the tab
    chats[id].name = `Chat ${Object.keys(chats).length + 0}`;
    
    activeChatId = id;
    saveToStorage();
    renderTabs();
    renderMessages();
    userInput.focus();
}


/* ===============================
   SWITCH TO CHAT
   =============================== */

function switchToChat(chatId) {
    if (chats[chatId]) {
        activeChatId = chatId;
        saveToStorage();
        renderTabs();
        renderMessages();
        userInput.focus();
    }
}


/* ===============================
   RENAME CURRENT CHAT
   =============================== */
function renameCurrentChat() {
    if (!activeChatId || !chats[activeChatId]) return;

    const tabBtn = Array.from(tabsContainer.children)
                        .find(btn => btn.textContent === (chats[activeChatId].name || `Chat ${Object.keys(chats).indexOf(activeChatId) + 1}`));

    if (!tabBtn) return;

    const currentName = tabBtn.textContent;
    
    // Make tab button editable
    tabBtn.setAttribute('contenteditable', 'true');
    tabBtn.focus();

    // Move cursor to end
    document.execCommand('selectAll', false, null);
    document.getSelection().collapseToEnd();

    // Save new name on Enter or blur
    const saveName = () => {
        const newName = tabBtn.textContent.trim();
        if (newName) {
            chats[activeChatId].name = newName;
        }
        tabBtn.removeAttribute('contenteditable');
        saveToStorage();
        renderTabs(); // Re-render tabs to reset styles
    };

    tabBtn.onblur = saveName;
    tabBtn.onkeypress = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // prevent newline
            tabBtn.blur();
        }
    };
}

/* ===============================
    LINK RENAME BUTTON
   =============================== */
const renameTabBtn = document.getElementById('renameTabBtn');
if (renameTabBtn) {
    renameTabBtn.onclick = renameCurrentChat;
}

function renderTabs() {
    if (!tabsContainer) return;

    tabsContainer.innerHTML = '';
    const chatIds = Object.keys(chats);

    // Safety check: if no chats or invalid activeChatId, create new chat
    if (chatIds.length === 0 || !activeChatId || !chats[activeChatId]) {
        if (chatIds.length === 0) {
            createNewChat();
            return;
        } else {
            activeChatId = chatIds[0];
            saveToStorage();
        }
    }

    chatIds.forEach((id, idx) => {
        const btn = document.createElement('button');
        btn.className = 'tab-btn' + (id === activeChatId ? ' active' : '');
        
        // Use custom name if exists, otherwise default Chat 1, Chat 2...
        const tabName = chats[id].name || `Chat ${idx + 1}`;
        btn.textContent = tabName;

        btn.onclick = () => switchToChat(id);
        btn.title = `Switch to ${tabName}`;
        tabsContainer.appendChild(btn);
    });
}

/* ===============================
   DELETE CURRENT CHAT
   =============================== */

function deleteCurrentChat() {
    const chatIds = Object.keys(chats);
    
    if (chatIds.length <= 1) {
        alert("Cannot delete the last chat. At least one chat must remain.");
        return;
    }

    if (!activeChatId || !chats[activeChatId]) return;
    
    const confirmDelete = confirm("Are you sure you want to delete this chat?");
    if (!confirmDelete) return;
    
    delete chats[activeChatId];
    
    // Switch to the first available chat
    const remainingChats = Object.keys(chats);
    activeChatId = remainingChats[0] || null;
    
    saveToStorage();
    renderTabs();
    renderMessages();
    userInput.focus();
}

/* ===============================
   EXPORT CURRENT CHAT
   =============================== */

// Function to export current chat in multiple formats
function exportCurrentChat() {
    const currentChat = conversations[currentChatIndex]; // Get active chat

    if (!currentChat || !currentChat.messages || currentChat.messages.length === 0) {
        alert("No messages to export for this chat.");
        return;
    }

    const format = document.getElementById("export-format").value;
    const filename = `chat_${currentChat.id || Date.now()}.${format}`;

    let blob;

    switch (format) {
        case "json":
            blob = new Blob([JSON.stringify(currentChat, null, 2)], { type: "application/json" });
            break;

        case "txt":
            const txtContent = currentChat.messages
                .map(msg => `[${msg.role.toUpperCase()}] ${msg.text}`)
                .join("\n");
            blob = new Blob([txtContent], { type: "text/plain" });
            break;

        case "csv":
            // CSV header
            const csvContent = [
                ["Role", "Message"]
                    .join(","),
                ...currentChat.messages.map(msg => `"${msg.role}","${msg.text.replace(/"/g, '""')}"`)
            ].join("\n");
            blob = new Blob([csvContent], { type: "text/csv" });
            break;

        case "doc":
            // Simple DOC using HTML content
            const docContent = `
                <html><body>
                ${currentChat.messages.map(msg => `<p><strong>${msg.role.toUpperCase()}:</strong> ${msg.text}</p>`).join('')}
                </body></html>`;
            blob = new Blob([docContent], { type: "application/msword" });
            break;

        case "pdf":
            // Use jsPDF (you need to include jsPDF library in HTML)
            const docPDF = new jsPDF();
            let y = 10;
            currentChat.messages.forEach(msg => {
                const lines = docPDF.splitTextToSize(`[${msg.role.toUpperCase()}] ${msg.text}`, 180);
                docPDF.text(lines, 10, y);
                y += lines.length * 10;
                if (y > 280) {
                    docPDF.addPage();
                    y = 10;
                }
            });
            docPDF.save(filename);
            return; // jsPDF handles saving
    }

    // For JSON, TXT, CSV, DOC
    if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// Attach event listener
document.getElementById("export-chat").addEventListener("click", exportCurrentChat);

/* ===============================
   HELPER FUNCTIONS
   =============================== */
function getActionButtonsHTML(isBot) {
    return `
        <div class="action-buttons">
            <button onclick="copyText(this)" title="Copy message">📋</button>
            ${isBot ? '<button onclick="regenerateText(this)" title="Regenerate response">🔄</button>' : ''}
            <button onclick="shareText(this)" title="Share message">📤</button>
            <button onclick="downloadText(this)" title="Download message">💾</button>
        </div>
    `;
}

function getSuggestionButtonsHTML() {
    const suggestions = [
        'What is Twin Health?',
        'How does it work?',
        'Benefits of Twin Health',
        'Who is eligible?',
        'Twin Health India',
        'How to join Twin Health program?'
    ];

    return `
        <div class="suggestions">
            ${suggestions.map(s => `<button class="suggestion-btn" onclick="sendSuggestion('${s.replace(/'/g, "\\'")}')">${s}</button>`).join('')}
        </div>
    `;
}

window.scrollChat = (direction) => {
    const scrollAmount = direction === 'up' ? -200 : 200;
    chatMessages.scrollBy({ top: scrollAmount, behavior: 'smooth' });
};

window.copyText = (button) => {
    const messageContent = button.closest('.message').querySelector('.message-content');
    // Remove suggestions HTML before copying
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = messageContent.innerHTML;
    const suggestionsDiv = tempDiv.querySelector('.suggestions');
    if (suggestionsDiv) suggestionsDiv.remove();
    
    const textToCopy = tempDiv.textContent.trim();
    
    navigator.clipboard.writeText(textToCopy).then(() => {
        const originalText = button.textContent;
        button.textContent = '✅';
        setTimeout(() => button.textContent = originalText, 1500);
    }).catch(err => console.error('Failed to copy text: ', err));
};

window.regenerateText = (button) => {
    const messageDiv = button.closest('.message');
    const prevMessage = messageDiv.previousElementSibling;
    
    if (prevMessage && prevMessage.classList.contains('user')) {
        const userQuery = prevMessage.querySelector('.message-content').textContent.trim();
        
        // Remove both messages from DOM
        messageDiv.remove();
        prevMessage.remove();

        // Remove from storage
        if (chats[activeChatId] && chats[activeChatId].length >= 2) {
            chats[activeChatId].pop(); // Remove bot message
            chats[activeChatId].pop(); // Remove user message
            saveToStorage();
        }

        // Regenerate response
        processMessage(userQuery);
    } else {
        alert("Can only regenerate the bot's response immediately following a user's query.");
    }
};

window.shareText = (button) => {
    const messageContent = button.closest('.message').querySelector('.message-content');
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = messageContent.innerHTML;
    const suggestionsDiv = tempDiv.querySelector('.suggestions');
    if (suggestionsDiv) suggestionsDiv.remove();
    
    const textToShare = tempDiv.textContent.trim();
    
    if (navigator.share) {
        navigator.share({
            title: 'Twin Health Chat',
            text: textToShare
        }).catch(error => console.log('Error sharing', error));
    } else {
        alert("Web Share API is not supported in this browser. Text has been copied to clipboard instead.");
        navigator.clipboard.writeText(textToShare);
    }
};

window.downloadText = (button) => {
    const messageContent = button.closest('.message').querySelector('.message-content');
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = messageContent.innerHTML;
    const suggestionsDiv = tempDiv.querySelector('.suggestions');
    if (suggestionsDiv) suggestionsDiv.remove();
    
    const textToDownload = tempDiv.textContent.trim();
    
    const blob = new Blob([textToDownload], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `twin-health-message-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};


/* ===============================
   CHAT UI RENDERING
   =============================== */
function renderMessages() {
    // Clear all messages except typing indicator
    Array.from(chatMessages.children)
        .filter(el => !el.classList.contains('typing-indicator'))
        .forEach(m => m.remove());

    // Render messages from active chat
    if (chats[activeChatId]) {
        chats[activeChatId].forEach(m => {
            addMessage(m.text, m.user, false, m.isWelcome);
        });
    }
    
    // Scroll to bottom
    setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 100);
}

function addMessage(text, isUser, save = true, isWelcome = false) {
    const msg = document.createElement('div');
    msg.className = `message ${isUser ? 'user' : 'bot'}`;

    let contentHTML = `<div class="message-content">${text}`;
    
    if (!isUser && isWelcome) {
        contentHTML += getSuggestionButtonsHTML();
    }
    
    contentHTML += `</div>`;
    
    msg.innerHTML = contentHTML + getActionButtonsHTML(!isUser);

    chatMessages.insertBefore(msg, typingIndicator);
    
    // Scroll to bottom
    setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 10);

    if (save && chats[activeChatId]) {
        chats[activeChatId].push({ 
            text, 
            user: isUser, 
            isWelcome: false 
        });
        saveToStorage();
    }
}

function defaultResponse() {
    return "I specialize in Twin Health, diabetes reversal, and metabolic health. Please ask a question related to these topics, and I'll be happy to help you!";
}

function processMessage(msg) {
    if (!msg || !msg.trim()) return;
    
    addMessage(msg, true);
    typingIndicator.style.display = 'block';

    setTimeout(() => {
        typingIndicator.style.display = 'none';
        const botResponse = findBestMatch(msg) || defaultResponse();
        addMessage(botResponse, false);
    }, 800);
}

window.sendMessage = () => {
    const msg = userInput.value.trim();
    if (!msg) return;

    userInput.value = '';
    processMessage(msg);
}

window.sendSuggestion = (text) => {
    userInput.value = text;
    sendMessage();
}


/* ===============================
   EVENT LISTENERS
   =============================== */
if (userInput) {
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}

if (newTabBtn) {
    newTabBtn.onclick = createNewChat;
}

if (deleteTabBtn) {
    deleteTabBtn.onclick = deleteCurrentChat;
}


/* ===============================
   INITIALIZATION
   =============================== */
window.addEventListener('load', async () => {
    // 1. Load theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark');
        if (themeToggle) themeToggle.textContent = '☀️';
    } else {
        if (themeToggle) themeToggle.textContent = '🌙';
    }

    // 2. Load knowledge base
    await loadKnowledgeBase();

    // 3. Load chats from storage
    loadFromStorage();

    // 4. Initialize chat system
    if (Object.keys(chats).length === 0 || !activeChatId || !chats[activeChatId]) {
        createNewChat();
    } else {
        renderTabs();
        renderMessages();
    }
    
    // 5. Focus input
    if (userInput) userInput.focus();
});

window.addEventListener('load', () => {
    const isDark = document.body.classList.contains('dark');
    themeToggle.setAttribute('data-tooltip', isDark ? 'Toggle light mode' : 'Toggle dark mode');
    });
