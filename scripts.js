/* ===============================
   GLOBAL STATE
   =============================== */
let chats = {};
let activeChatId = null;

let kbEntries = [];
let kbLoaded = false;

// Initialize DOM elements after page loads
let chatMessages;
let userInput;
let typingIndicator;
let themeToggle;
let tabsContainer;
let newTabBtn;
let deleteTabBtn;
let sendBtn;


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
    if (themeToggle) {
        themeToggle.textContent = isDark ? '☀️' : '🌙';
        themeToggle.setAttribute('data-tooltip', isDark ? 'Toggle light mode' : 'Toggle dark mode');
    }
}

/* ===============================
   KNOWLEDGE BASE (KB) LOADING
   =============================== */
async function loadKnowledgeBase() {
    try {
        const response = await fetch('knowledge_base.json');
        const data = await response.json();
        kbEntries = Array.isArray(data.entries) ? data.entries : [];
        kbLoaded = true;
        console.log('Knowledge base loaded successfully:', kbEntries.length, 'entries');
    } catch (err) {
        kbLoaded = false;
        console.error('KB load failed', err);
    }
}

/* ===============================
   ENHANCED MATCHING ALGORITHM
   =============================== */

// Normalize text for better matching
function normalizeText(text) {
    return (text || '')
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')  // Replace punctuation with space
        .replace(/\s+/g, ' ')       // Collapse multiple spaces
        .trim();
}

// Extract meaningful words (remove common stop words)
function extractKeywords(text) {
    const stopWords = new Set([
        'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
        'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
        'to', 'was', 'will', 'with', 'can', 'do', 'does', 'what', 'how',
        'why', 'when', 'where', 'who', 'i', 'my', 'me', 'you', 'your'
    ]);
    
    return normalizeText(text)
        .split(' ')
        .filter(word => word.length > 2 && !stopWords.has(word));
}

// Calculate similarity between two texts using multiple methods
function calculateSimilarity(userText, kbText) {
    const userNorm = normalizeText(userText);
    const kbNorm = normalizeText(kbText);
    
    // Method 1: Exact phrase match (highest score)
    if (kbNorm.includes(userNorm) || userNorm.includes(kbNorm)) {
        return 100;
    }
    
    // Method 2: Word overlap scoring
    const userWords = extractKeywords(userText);
    const kbWords = extractKeywords(kbText);
    
    if (userWords.length === 0) return 0;
    
    let matchCount = 0;
    for (const word of userWords) {
        if (kbWords.includes(word)) {
            matchCount++;
        }
    }
    
    // Calculate percentage of user words that matched
    return (matchCount / userWords.length) * 80;
}

// Find best matching KB entry
function findBestMatch(userMessage) {
    if (!kbLoaded || !userMessage || userMessage.trim().length < 2) {
        return null;
    }

    const userQuery = normalizeText(userMessage);
    const userKeywords = extractKeywords(userMessage);
    
    let bestMatch = null;
    let bestScore = 0;

    for (const entry of kbEntries) {
        let score = 0;
        
        // Score 1: Question similarity (weight: 5x)
        const questionSim = calculateSimilarity(userMessage, entry.question);
        score += questionSim * 5;
        
        // Score 2: Tag matching (weight: 3x)
        if (entry.tags && Array.isArray(entry.tags)) {
            for (const tag of entry.tags) {
                const tagSim = calculateSimilarity(userMessage, tag);
                score += tagSim * 3;
            }
        }
        
        // Score 3: Category matching (weight: 2x)
        if (entry.category) {
            const categorySim = calculateSimilarity(userMessage, entry.category);
            score += categorySim * 2;
        }
        
        // Score 4: Answer keywords (weight: 1x)
        const answerSim = calculateSimilarity(userMessage, entry.answer);
        score += answerSim * 1;
        
        // Update best match if this score is higher
        if (score > bestScore) {
            bestScore = score;
            bestMatch = entry;
        }
    }
    
    // Require minimum score threshold
    const threshold = 50; // Lowered from 100 for better matching
    
    if (bestScore >= threshold && bestMatch) {
        console.log(`Match found: "${bestMatch.question}" with score ${bestScore.toFixed(2)}`);
        return {
            answer: bestMatch.answer,
            source: bestMatch.source || 'Twin Health Knowledge Base',
            score: bestScore
        };
    }
    
    console.log(`No match found. Best score was ${bestScore.toFixed(2)}`);
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
    chats[id].name = `Chat ${Object.keys(chats).length + 1}`; // ADDED + 1 for correct count
    
    activeChatId = id;
    saveToStorage();
    renderTabs();
    renderMessages();
    if (userInput) userInput.focus();
}

function switchToChat(chatId) {
    if (chats[chatId]) {
        activeChatId = chatId;
        saveToStorage();
        renderTabs();
        renderMessages();
        if (userInput) userInput.focus();
    }
}

/* ===============================
   RENAME CURRENT CHAT - FIXED
   =============================== */
function renameCurrentChat() {
    if (!activeChatId || !chats[activeChatId] || !tabsContainer) {
        console.log('Rename failed: missing requirements');
        return;
    }

    // Find the active tab button by class
    const tabBtn = tabsContainer.querySelector('.tab-btn.active');

    if (!tabBtn) {
        console.log('Rename failed: no active tab button found');
        return;
    }
    
    // Store original name for restoration if needed
    const originalName = tabBtn.textContent.trim();
    console.log('Starting rename for:', originalName);
    
    // Make tab button editable
    tabBtn.setAttribute('contenteditable', 'true');
    tabBtn.style.outline = '2px solid #667eea';
    tabBtn.style.backgroundColor = '#ffffff';
    tabBtn.focus();

    // Select all text
    setTimeout(() => {
        const range = document.createRange();
        range.selectNodeContents(tabBtn);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }, 0);

    // Save new name on Enter or blur
    const saveName = () => {
        const newName = tabBtn.textContent.trim();
        console.log('Saving new name:', newName);
        
        if (newName && newName.length > 0) {
            chats[activeChatId].name = newName;
            console.log('Name saved successfully');
        } else {
            // Restore original name if empty
            console.log('Name was empty, restoring original');
            tabBtn.textContent = originalName;
        }
        
        tabBtn.removeAttribute('contenteditable');
        tabBtn.style.outline = '';
        tabBtn.style.backgroundColor = '';
        tabBtn.onblur = null;
        tabBtn.onkeydown = null;
        
        saveToStorage();
        renderTabs();
    };

    tabBtn.onblur = saveName;
    tabBtn.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            console.log('Enter pressed, saving name');
            tabBtn.blur();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            console.log('Escape pressed, canceling rename');
            tabBtn.textContent = originalName;
            tabBtn.blur();
        }
    };
}

/* ===============================
   DOWNLOAD CONVERSATION HISTORY - FIXED
   =============================== */
function downloadConversationHistory() {
    console.log('Download function called');
    console.log('Active chat ID:', activeChatId);
    console.log('Chats object:', chats);
    
    if (!activeChatId || !chats[activeChatId]) {
        alert('No active chat to download.');
        console.log('Download failed: no active chat');
        return;
    }

    const messages = chats[activeChatId];
    const chatName = chats[activeChatId].name || 'Twin Health Chat';
    
    console.log('Chat name:', chatName);
    console.log('Total messages:', messages.length);
    
    // Format the conversation
    let conversationText = `${chatName}\n`;
    conversationText += `Downloaded: ${new Date().toLocaleString()}\n`;
    conversationText += `${'='.repeat(60)}\n\n`;

    let messageCount = 0;
    messages.forEach((msg, index) => {
        // Skip the initial welcome message
        if (msg.isWelcome) {
            console.log('Skipping welcome message');
            return;
        }
        
        const speaker = msg.user ? 'You' : 'Twin Health Assistant';
        
        conversationText += `[${speaker}]\n`;
        conversationText += `${msg.text}\n\n`;
        conversationText += `${'-'.repeat(60)}\n\n`;
        messageCount++;
    });

    console.log('Messages to download:', messageCount);

    if (messageCount === 0) {
        alert('No messages to download yet. Start a conversation first!');
        return;
    }

    // Create and download the file
    try {
        const blob = new Blob([conversationText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = `${chatName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.txt`;
        a.download = filename;
        
        console.log('Creating download with filename:', filename);
        
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            console.log('Download completed and cleaned up');
        }, 100);
        
    } catch (error) {
        console.error('Download error:', error);
        alert('Error downloading conversation. Please try again.');
    }
}

// Make functions available globally
window.downloadConversationHistory = downloadConversationHistory;
window.renameCurrentChat = renameCurrentChat;

/* ===============================
   UPDATE SETUP RENAME BUTTON
   =============================== */
function setupRenameButton() {
    const renameTabBtn = document.getElementById('renameTabBtn');
    if (renameTabBtn) {
        // Remove any existing listeners
        renameTabBtn.onclick = null;
        // Add new listener
        renameTabBtn.onclick = (e) => {
            e.preventDefault();
            console.log('Rename button clicked');
            renameCurrentChat();
        };
        console.log('Rename button setup complete');
    } else {
        console.log('Rename button not found in DOM');
    }
}

// Also add download button setup
function setupDownloadButton() {
    const downloadBtn = document.getElementById('downloadHistoryBtn');
    if (downloadBtn) {
        downloadBtn.onclick = (e) => {
            e.preventDefault();
            console.log('Download button clicked');
            downloadConversationHistory();
        };
        console.log('Download button setup complete');
    } else {
        console.log('Download button not found in DOM');
    }
}

function renderTabs() {
    if (!tabsContainer) return;

    tabsContainer.innerHTML = '';
    const chatIds = Object.keys(chats);

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
        
        const tabName = chats[id].name || `Chat ${chatIds.indexOf(id) + 1}`;
        btn.textContent = tabName;

        btn.onclick = () => switchToChat(id);
        btn.title = `Switch to ${tabName}`;
        tabsContainer.appendChild(btn);
    });
}

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
    
    const remainingChats = Object.keys(chats);
    activeChatId = remainingChats[0] || null;
    
    saveToStorage();
    renderTabs();
    renderMessages();
    if (userInput) userInput.focus();
}

/* ===============================
   HELPER FUNCTIONS (UI ACTIONS)
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
        'Where is Twin Health available?',
        'How to join Twin Health program?'
    ];

    return `
        <div class="suggestions">
            ${suggestions.map(s => `<button class="suggestion-btn" onclick="sendSuggestion('${s.replace(/'/g, "\\'")}')">${s}</button>`).join('')}
        </div>
    `;
}

window.scrollChat = (direction) => {
    if (!chatMessages) return;
    const scrollAmount = direction === 'up' ? -200 : 200;
    chatMessages.scrollBy({ top: scrollAmount, behavior: 'smooth' });
};

window.copyText = (button) => {
    const messageContent = button.closest('.message').querySelector('.message-content');
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
        
        messageDiv.remove();
        prevMessage.remove();

        if (chats[activeChatId] && chats[activeChatId].length >= 2) {
            chats[activeChatId].pop();
            chats[activeChatId].pop();
            saveToStorage();
        }

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
    if (!chatMessages) return;
    
    Array.from(chatMessages.children)
        .filter(el => !el.classList.contains('typing-indicator') && !el.classList.contains('scroll-nav'))
        .forEach(m => m.remove());

    if (chats[activeChatId]) {
        chats[activeChatId].forEach(m => {
            addMessage(m.text, m.user, false, m.isWelcome);
        });
    }
    
    setTimeout(() => {
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }, 100);
}

function addMessage(text, isUser, save = true, isWelcome = false) {
    if (!chatMessages) return;
    
    const msg = document.createElement('div');
    msg.className = `message ${isUser ? 'user' : 'bot'}`;

    let contentHTML = `<div class="message-content">${text}`;
    
    if (!isUser && isWelcome) {
        contentHTML += getSuggestionButtonsHTML();
    }
    
    contentHTML += `</div>`;
    
    msg.innerHTML = contentHTML + getActionButtonsHTML(!isUser);

    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        chatMessages.insertBefore(msg, typingIndicator);
    } else {
        chatMessages.appendChild(msg);
    }
    
    setTimeout(() => {
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
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

/* ===============================
   NLP & RESPONSE LOGIC HELPERS
   =============================== */
function defaultResponse() {
    return "I specialize in Twin Health, diabetes reversal, and metabolic health. Please ask a question related to these topics, and I'll be happy to help you!";
}

function isGreeting(text) {
    const greetings = ['hello', 'hi', 'hii', 'hey', 'good morning', 'good afternoon', 'good evening', 'how are you', 'whats up', 'sup'];
    const normalized = normalizeText(text);
    return greetings.some(g => normalized === g || normalized.startsWith(g + ' '));
}

function isEnding(text) {
    const farewells = ['bye', 'goodbye', 'see you', 'cya', 'farewell', 'that is all', 'thats all', 'thanks and bye', 'thank you bye', 'im done', 'talk to you later'];
    const normalized = normalizeText(text);
    return farewells.some(f => normalized.includes(f));
}

function isThanking(text) {
    const thanks = ['thank you', 'thanks', 'appreciate it', 'thx'];
    const normalized = normalizeText(text);
    return thanks.some(t => normalized.includes(t));
}

/* ===============================
   MAIN MESSAGE PROCESSING
   =============================== */
function processMessage(msg) {
    if (!msg || !msg.trim()) return;
    
    const userQuery = msg.trim();
    addMessage(userQuery, true);
    
    if (typingIndicator) {
        typingIndicator.style.display = 'block';
    }
    
    setTimeout(() => {
        if (typingIndicator) {
            typingIndicator.style.display = 'none';
        }
        
        let botResponse = '';
        
        // Priority 1: Greetings
        if (isGreeting(userQuery)) {
            botResponse = 'Hello! How can I help you today with your Twin Health journey?';
        }
        // Priority 2: Thanks/Gratitude
        else if (isThanking(userQuery)) {
            botResponse = "You're very welcome! I'm happy to help. Feel free to reach out anytime you have more questions about your health journey.";
        }
        // Priority 3: Farewell
        else if (isEnding(userQuery)) {
            botResponse = 'Goodbye! Feel free to come back anytime if you have more questions about Twin Health. Have a great day!';
        }
        // Priority 4: Knowledge Base Search
        else {
            const kbMatch = findBestMatch(userQuery);
            
            if (kbMatch) {
                botResponse = `${kbMatch.answer}\n\n<em>Source: ${kbMatch.source}</em>`;
            } else {
                // Default fallback
                botResponse = defaultResponse();
            }
        }

        addMessage(botResponse, false);
    }, 800);
}

window.sendMessage = () => {
    if (!userInput) {
        console.error('userInput element not found');
        return;
    }
    
    const msg = userInput.value.trim();

    if (!msg) {
        userInput.setCustomValidity("Message box is empty. Please enter your query");
        userInput.reportValidity();
        
        setTimeout(() => {
            userInput.setCustomValidity("");
        }, 3000); 
        
        return;
    }

    userInput.setCustomValidity("");
    userInput.value = '';
    processMessage(msg);
}

window.sendSuggestion = (text) => {
    if (!userInput) return;
    userInput.value = text;
    sendMessage();
}

/* ===============================
   INITIALIZATION
   =============================== */
function initializeApp() {
    chatMessages = document.getElementById('chatMessages');
    userInput = document.getElementById('userInput');
    typingIndicator = document.getElementById('typingIndicator');
    themeToggle = document.getElementById('themeToggle');
    tabsContainer = document.getElementById('tabsContainer');
    newTabBtn = document.getElementById('newTabBtn');
    deleteTabBtn = document.getElementById('deleteTabBtn');
    sendBtn = document.getElementById('sendBtn');

    console.log('DOM Elements initialized:', {
        chatMessages: !!chatMessages,
        userInput: !!userInput,
        sendBtn: !!sendBtn
    });

    if (userInput) {
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Send button clicked');
            sendMessage();
        });
    }

    if (newTabBtn) {
        newTabBtn.onclick = createNewChat;
    }

    if (deleteTabBtn) {
        deleteTabBtn.onclick = deleteCurrentChat;
    }

    setupRenameButton();

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark');
        if (themeToggle) themeToggle.textContent = '☀️';
    } else {
        if (themeToggle) themeToggle.textContent = '🌙';
    }

    loadKnowledgeBase();

    loadFromStorage();

    if (Object.keys(chats).length === 0 || !activeChatId || !chats[activeChatId]) {
        createNewChat();
    } else {
        renderTabs();
        renderMessages();
    }
    
    if (userInput) userInput.focus();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

window.addEventListener('load', () => {
    const isDark = document.body.classList.contains('dark');
    if (themeToggle) {
        themeToggle.setAttribute('data-tooltip', isDark ? 'Toggle light mode' : 'Toggle dark mode');
    }
});
