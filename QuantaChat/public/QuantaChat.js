import WebRTC from './WebRTC.js';
import IndexedDB from './IndexedDB.js';
console.log("QuantaChat Version 0.1.4");

import Utils from './Util.js';
const util = Utils.getInst();
const elm = document.getElementById.bind(document);

class QuantaChat {
    selectedFiles = [];
    storage = null;
    rtc = null;
    messages = null;

    // Message storage and persistence functions
    saveMessages() {
        try {
            // Get existing room data or create a new room object
            const roomData = {
                messages: this.messages,
                lastUpdated: new Date().toISOString()
            };

            this.storage.setItem('room_' + this.rtc.roomId, roomData);
            util.log('Saved ' + this.messages.length + ' messages for room: ' + roomId);
        } catch (error) {
            util.log('Error saving messages: ' + error);
        }
    }

    async loadRoomMessages(roomId) {
        try {
            const roomData = await this.storage.getItem('room_' + roomId);
            if (roomData) {
                util.log('Loaded ' + roomData.messages.length + ' messages for room: ' + roomId);
                return roomData.messages || [];
            }
        } catch (error) {
            util.log('Error loading messages from storage: ' + error);
        }
        return [];
    }

    // Helper function to create message DOM elements
    _createMessageElement(msg) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');

        if (msg.sender === 'system') {
            messageDiv.classList.add('system');
            messageDiv.textContent = msg.content;
            return messageDiv;
        }

        // Create container for rendered markdown
        const messageContent = document.createElement('div');
        messageContent.classList.add('message-content');

        // Create a header container for sender and timestamp
        const messageHeader = document.createElement('div');
        messageHeader.classList.add('message-header');

        // Add sender prefix
        const senderSpan = document.createElement('span');
        senderSpan.classList.add('message-sender');

        if (msg.sender === this.rtc.userName) {
            messageDiv.classList.add('local');
            senderSpan.textContent = 'You: ';
        } else {
            messageDiv.classList.add('remote');
            senderSpan.textContent = msg.sender + ': ';
        }

        messageHeader.appendChild(senderSpan);

        // Add timestamp if available
        if (msg.timestamp) {
            const timestampSpan = document.createElement('span');
            timestampSpan.classList.add('message-timestamp');

            // Format the timestamp
            const messageDate = new Date(msg.timestamp);
            const timeString = messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            timestampSpan.textContent = timeString;

            messageHeader.appendChild(timestampSpan);
        }

        messageDiv.appendChild(messageHeader);

        // Render markdown content if there's any text message
        if (msg.content && msg.content.trim() !== '') {
            messageContent.innerHTML = util.renderContent(msg.content);
        }

        // Handle attachments if any
        if (msg.attachments && msg.attachments.length > 0) {
            const attachmentsDiv = document.createElement('div');
            attachmentsDiv.classList.add('attachments');

            msg.attachments.forEach(attachment => {
                if (attachment.type.startsWith('image/')) {
                    // Display image inline
                    const imgContainer = document.createElement('div');
                    imgContainer.classList.add('attachment-container');

                    const img = document.createElement('img');
                    img.src = attachment.data;
                    img.alt = attachment.name;
                    img.classList.add('attachment-image');
                    img.style.maxWidth = '250px';
                    img.style.cursor = 'pointer';
                    img.title = "Click to view full size";

                    // View full size on click
                    img.addEventListener('click', (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        this.openImageViewer(attachment.data, attachment.name);
                        return false;
                    });

                    // Add download button for images
                    const downloadBtn = document.createElement('button');
                    downloadBtn.classList.add('download-button', 'image-download');
                    downloadBtn.innerHTML = '⬇️';
                    downloadBtn.title = `Download ${attachment.name}`;
                    downloadBtn.onclick = (event) => {
                        event.stopPropagation();
                        this.downloadAttachment(attachment.data, attachment.name);
                    };

                    imgContainer.appendChild(img);
                    imgContainer.appendChild(downloadBtn);
                    attachmentsDiv.appendChild(imgContainer);
                } else {
                    // Create a download button for non-image files
                    const fileContainer = document.createElement('div');
                    fileContainer.classList.add('file-attachment');

                    const fileIcon = document.createElement('span');
                    fileIcon.textContent = '📄 ';
                    fileContainer.appendChild(fileIcon);

                    const fileName = document.createElement('span');
                    fileName.textContent = `${attachment.name} (${util.formatFileSize(attachment.size)})`;
                    fileContainer.appendChild(fileName);

                    const downloadButton = document.createElement('button');
                    downloadButton.classList.add('download-button');
                    downloadButton.textContent = 'Download';
                    downloadButton.title = `Download ${attachment.name}`;
                    downloadButton.onclick = () => {
                        this.downloadAttachment(attachment.data, attachment.name);
                    };

                    fileContainer.appendChild(downloadButton);
                    attachmentsDiv.appendChild(fileContainer);
                }
            });
            messageContent.appendChild(attachmentsDiv);
        }
        messageDiv.appendChild(messageContent);
        return messageDiv;
    }

    // Modified display message function to use the common renderer
    _displayMessage = (msg) => {
        console.log("Displaying message from " + msg.sender + ": " + msg.content);
        const chatLog = elm('chatLog');
        const messageDiv = this._createMessageElement(msg);
        chatLog.appendChild(messageDiv);
        chatLog.scrollTop = chatLog.scrollHeight;
    }

    // Load and display all messages for a room
    async displayRoomHistory(roomId) {
        if (!this.messages) {
            this.messages = await this.loadRoomMessages(roomId);
        }

        // Clear the current chat log
        const chatLog = elm('chatLog');
        chatLog.innerHTML = '';

        // Display system message about history
        if (this.messages.length > 0) {
            const systemMsg = {
                sender: 'system',
                content: 'Loading message history...'
            };
            chatLog.appendChild(this._createMessageElement(systemMsg));

            this.messages.forEach(msg => {
                // print the message to the console
                console.log('Message from ' + msg.sender + ': ' + msg.content + ' at ' + msg.timestamp);
                if (msg.attachments && msg.attachments.length > 0) {
                    console.log('Message has ' + msg.attachments.length + ' attachment(s)');
                }

                chatLog.appendChild(this._createMessageElement(msg));
            });

            const endMsg = {
                sender: 'system',
                content: 'End of message history'
            };
            chatLog.appendChild(this._createMessageElement(endMsg));
        } else {
            const noHistoryMsg = {
                sender: 'system',
                content: 'No message history for this room'
            };
            chatLog.appendChild(this._createMessageElement(noHistoryMsg));
        }

        // Scroll to bottom
        chatLog.scrollTop = chatLog.scrollHeight;
    }

    _clearChatHistory = () => {
        if (confirm(`Are you sure you want to clear all chat history for room "${this.rtc.roomId}"?`)) {
            this.messages = [];
            this.storage.removeItem('room_' + this.rtc.roomId);

            // Clear the chat log display
            const chatLog = elm('chatLog');
            chatLog.innerHTML = '';

            // Display a system message
            const systemMsg = document.createElement('div');
            systemMsg.classList.add('message', 'system');
            systemMsg.textContent = 'Chat history has been cleared';
            chatLog.appendChild(systemMsg);

            util.log('Cleared chat history for room: ' + this.rtc.roomId);
        }
    }

    _updateParticipantsList = () => {
        const list = elm('participantsList');
        if (this.rtc.participants.size === 0) {
            list.textContent = 'QuantaChat: No participants yet';
        } else {
            list.textContent = 'QuantaChat with: ' + Array.from(this.rtc.participants).join(', ');
        }
    }

    _updateConnectionStatus = () => {
        // Enable input if we have at least one open data channel or we're connected to the signaling server
        const hasOpenChannel = Array.from(this.rtc.dataChannels.values()).some(channel => channel.readyState === 'open');

        const messageInput = elm('messageInput');
        const sendButton = elm('sendButton');
        const attachButton = elm('attachButton');

        if (hasOpenChannel || this.rtc.connected) {
            messageInput.disabled = false;
            sendButton.disabled = false;
            attachButton.disabled = false;
        } else {
            messageInput.disabled = true;
            sendButton.disabled = true;
            attachButton.disabled = true;
        }
    }

    _persistMessage = async (msg) => {
        // Get current messages, add new one, and save
        if (!this.messages) {
            this.messages = await this.loadRoomMessages(this.rtc.roomId);
        }

        if (this.messageExists(msg)) {
            return false; // Message already exists, do not save again
        }

        try {
            await this.autoPruneDatabase(msg);
            this.messages.push(msg);
            this.saveMessages();
            return true;
        } catch (error) {
            util.log('Error checking storage or saving message: ' + error);
            // Still try to save the message
            this.messages.push(msg);
            this.saveMessages();
            return true;
        }
    }

    // todo-0: we could drop into the messages a note item that says "X old messages deleted to save space", and just update that every time
    async autoPruneDatabase(msg) {
        if (navigator.storage && navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();
            const remainingStorage = estimate.quota - estimate.usage;
            const usagePercentage = (estimate.usage / estimate.quota) * 100;
            const forceClean = false; // set to true to simuilate low storage, and cause pruning

            console.log(`Storage: (${Math.round(usagePercentage)}% used). Quota: ${util.formatStorageSize(estimate.quota)}`);

            // Calculate message size and check storage limits
            const msgSize = this.calculateMessageSize(msg);

            // If we're within 10% of storage limit
            if (remainingStorage < msgSize || usagePercentage > 90 || forceClean) {
                const warningMsg = `You're running low on storage space (${Math.round(usagePercentage)}% used). ` +
                    `Would you like to remove the oldest 20% of messages to free up space?`;

                if (confirm(warningMsg)) {
                    // Sort messages by timestamp and remove oldest 20%
                    this.messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                    const messageCountToRemove = Math.ceil(this.messages.length * 0.20);
                    this.messages = this.messages.slice(messageCountToRemove);

                    // Save the pruned messages
                    this.saveMessages();
                    util.log(`Removed ${messageCountToRemove} old messages due to storage constraints`);
                }
            }
        }
    }

    // Calculate the size of a message object in bytes
    calculateMessageSize(msg) {
        let totalSize = 0;

        // Text content size
        if (msg.content) {
            totalSize += new Blob([msg.content]).size;
        }

        // Metadata size (sender, timestamp, etc.)
        totalSize += new Blob([JSON.stringify({
            sender: msg.sender,
            timestamp: msg.timestamp
        })]).size;

        // Attachments size
        if (msg.attachments && msg.attachments.length > 0) {
            msg.attachments.forEach(attachment => {
                // Base64 data URLs are approximately 33% larger than the original binary
                // The actual data portion is after the comma in "data:image/jpeg;base64,..."
                if (attachment.data) {
                    const dataUrl = attachment.data;
                    const base64Index = dataUrl.indexOf(',') + 1;
                    if (base64Index > 0) {
                        const base64Data = dataUrl.substring(base64Index);
                        // Convert from base64 size to binary size (approx)
                        totalSize += Math.floor((base64Data.length * 3) / 4);
                    } else {
                        // Fallback if data URL format is unexpected
                        totalSize += new Blob([dataUrl]).size;
                    }
                }

                // Add size of attachment metadata
                totalSize += new Blob([JSON.stringify({
                    name: attachment.name,
                    type: attachment.type,
                    size: attachment.size
                })]).size;
            });
        }

        return totalSize;
    }

    messageExists(msg) {
        return this.messages.some(message =>
            message.timestamp === msg.timestamp &&
            message.sender === msg.sender &&
            message.content === msg.content
        );
    }

    _handleFileSelect = () => {
        const fileInput = elm('fileInput');
        fileInput.click();
    }

    // File input change handler
    _handleFiles = async () => {
        const fileInput = elm('fileInput');
        if (fileInput.files.length > 0) {
            this.selectedFiles = [];

            // Convert files to the format we need
            for (let i = 0; i < fileInput.files.length; i++) {
                try {
                    const fileData = await util.fileToBase64(fileInput.files[i]);
                    this.selectedFiles.push(fileData);
                } catch (error) {
                    util.log('Error processing file: ' + error);
                }
            }

            // Update UI to show files are attached
            const attachButton = elm('attachButton');
            attachButton.textContent = `📎(${this.selectedFiles.length})`;
            attachButton.title = `${this.selectedFiles.length} file(s) attached`;
        }
    }

    // Clear attachments after sending
    clearAttachments() {
        this.selectedFiles = [];
        const attachButton = elm('attachButton');
        attachButton.textContent = '📎';
        attachButton.title = 'Attach files';
        const fileInput = elm('fileInput');
        fileInput.value = '';
    }

    // Add this function to create and manage the image viewer modal
    createImageViewerModal() {
        // Create modal elements if they don't exist
        if (!elm('image-viewer-modal')) {
            const modal = document.createElement('div');
            modal.id = 'image-viewer-modal';
            modal.classList.add('image-viewer-modal');

            const modalContent = document.createElement('div');
            modalContent.classList.add('modal-content');

            const closeBtn = document.createElement('span');
            closeBtn.classList.add('close-modal');
            closeBtn.innerHTML = '&times;';
            closeBtn.title = 'Close (Esc)';
            closeBtn.onclick = closeImageViewer;

            const imageElement = document.createElement('img');
            imageElement.id = 'modal-image';
            imageElement.classList.add('modal-image');

            modalContent.appendChild(closeBtn);
            modalContent.appendChild(imageElement);
            modal.appendChild(modalContent);

            // Add click handler to close when clicking outside the image
            modal.addEventListener('click', (event) => {
                if (event.target === modal) {
                    this.closeImageViewer();
                }
            });

            // Add keyboard handler for Escape key
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && modal.style.display === 'flex') {
                    this.closeImageViewer();
                }
            });

            document.body.appendChild(modal);
        }
    }

    // Function to open the image viewer
    openImageViewer(imageSrc, altText) {
        this.createImageViewerModal(); // Ensure modal exists

        const modal = elm('image-viewer-modal');
        const modalImg = elm('modal-image');

        modalImg.src = imageSrc;
        modalImg.alt = altText || 'Full-size image';

        // Display the modal with a fade-in effect
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.style.opacity = '1';
        }, 10);
    }

    // Function to close the image viewer
    closeImageViewer() {
        const modal = elm('image-viewer-modal');
        if (modal) {
            modal.style.opacity = '0';
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300); // Match this with CSS transition duration
        }
    }

    // Function to handle downloading a file attachment
    downloadAttachment(dataUrl, fileName) {
        // Create a temporary anchor element
        const downloadLink = document.createElement('a');
        downloadLink.href = dataUrl;
        downloadLink.download = fileName;

        // Append to body, trigger click, then remove
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    }

    async initApp() {
        console.log("QuantaChat initApp");
        this.storage = await IndexedDB.getInst("quantaChatDB", "quantaChatStore", 1);
        this.rtc = await WebRTC.getInst(this.storage, this);

        // Event listeners
        elm('connectButton').addEventListener('click', this._connect);
        elm('disconnectButton').addEventListener('click', this._disconnect);
        elm('sendButton').addEventListener('click', this._send);
        elm('attachButton').addEventListener('click', this._handleFileSelect);
        elm('fileInput').addEventListener('change', this._handleFiles);
        elm('clearButton').addEventListener('click', this._clearChatHistory);

        const usernameInput = elm('username');
        const roomInput = elm('roomId');

        elm('clearButton').disabled = true;

        // Check for 'user' parameter in URL first, fallback to this.rtc.userName
        const userFromUrl = util.getUrlParameter('user');
        usernameInput.value = userFromUrl || this.rtc.userName;

        const roomFromUrl = util.getUrlParameter('room');
        roomInput.value = roomFromUrl || this.rtc.roomId;

        // if userFromUrl and rootFromUrl are both non-empty then wait a half second and then call _connect
        if (userFromUrl && roomFromUrl) {
            setTimeout(() => {
                this.rtc.userName = usernameInput.value;
                this.rtc.roomId = roomInput.value;
                elm('connectButton').click();
            }, 500);
        }
    }

    _connect = () => {
        this.messages = null;
        console.log("Connecting to room: " + this.rtc.roomId);

        const usernameInput = elm('username');
        const user = usernameInput.value.trim();

        const roomInput = elm('roomId');
        const room = roomInput.value.trim();

        // if user or room is empty, return
        if (!user || !room) {
            alert('Please enter both username and room name');
            return;
        }

        this.rtc._connect(user, room);

        // todo-0: need a 'stateChange' method for handling all kinds of stuff like this
        usernameInput.disabled = true;
        roomInput.disabled = true;
        elm('connectButton').disabled = true;
        elm('disconnectButton').disabled = false;
        elm('clearButton').disabled = false;
    }

    _disconnect = () => {
        this.messages = null;
        this.rtc._disconnect();
        this._updateParticipantsList();

        // Clear the chat log
        const chatLog = elm('chatLog');
        chatLog.innerHTML = '';

        // Re-enable form inputs
        elm('username').disabled = false;
        elm('roomId').disabled = false;
        elm('connectButton').disabled = false;
        elm('disconnectButton').disabled = true;
        elm('clearButton').disabled = true;
        elm('messageInput').disabled = true;
        elm('sendButton').disabled = true;
        elm('attachButton').disabled = true;

        this._updateConnectionStatus();

        // Clear any selected files
        this.clearAttachments();
        util.log('Disconnected from chat');
    }

    _send = () => {
        const input = elm('messageInput');
        const message = input.value.trim();
        this.rtc._sendMessage(message, this.selectedFiles);
        this.clearAttachments();
        input.value = '';
    }
}

document.addEventListener('DOMContentLoaded', function () {
    console.log("calling initApp");
    const app = new QuantaChat();
    app.initApp();
});