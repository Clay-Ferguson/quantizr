import WebRTC from './WebRTC.js';
import IndexedDB from './IndexedDB.js';
console.log("QuantaChat Version 0.1.4");

// todo-0: make sure all user actions get followed up by a mr.refreshAll() call, after the MiniReact transition is complete

import Utils from './Util.js';
const util = Utils.getInst();

import DOM from './DOM.js';
const dom = DOM.getInst();

import MiniReact from './MiniReact.js';
const mr = MiniReact.getInst();

const _ = null;

class QuantaChat {
    selectedFiles = [];
    storage = null;
    rtc = null;
    messages = null;

    async initApp() {
        console.log("QuantaChat initApp");

        // todo-0: both these singletons are inconsistent with how other singletons are initialized
        this.storage = await IndexedDB.getInst("quantaChatDB", "quantaChatStore", 1);
        this.rtc = await WebRTC.getInst(this.storage, this);

        mr.addSection("formGroup", this._formGroup);
        mr.addSection("messageControls", this._messageControls);
        mr.refreshAll()

        const usernameInput = dom.byId('username');
        const roomInput = dom.byId('roomId');

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
                // dom.byId('connectButton').click();
                this._connect();
            }, 500);
        }
    }

    _rtcStateChange = () => {
        console.log("RTC state changed: connected=", this.rtc.connected);
        mr.refreshAll();
        this._updateConnectionStatus();
    }

    _formGroup = () => {
        return {
            type: 'div',
            props: {
                className: 'form-group'
            },
            children: [
                {
                    type: 'label',
                    props: {
                        htmlFor: 'username',
                        text: 'Username:'
                    }
                },
                {
                    type: 'input',
                    props: {
                        type: 'text',
                        id: 'username',
                        placeholder: 'Your name',
                        className: 'form-control',
                        disabled: this.rtc.connected
                    }
                },
                {
                    type: 'label',
                    props: {
                        htmlFor: 'roomId',
                        text: 'Room:'
                    }
                },
                {
                    type: 'input',
                    props: {
                        type: 'text',
                        id: 'roomId',
                        placeholder: 'Room name',
                        value: 'default-room',
                        className: 'form-control',
                        disabled: this.rtc.connected
                    }
                },
                {
                    type: 'button',
                    props: {
                        id: 'connectButton',
                        className: 'btn',
                        text: 'Connect',
                        onClick: this._connect,
                        disabled: this.rtc.connected
                    }
                },
                {
                    type: 'button',
                    props: {
                        id: 'disconnectButton',
                        className: 'btn',
                        disabled: !this.rtc.connected,
                        text: 'Disconnect',
                        onClick: this._disconnect,
                    }
                },
                {
                    type: 'button',
                    props: {
                        id: 'clearButton',
                        className: 'btn',
                        disabled: !this.rtc.connected || this.messages.length === 0,
                        text: 'Clear',
                        onClick: this._clearChatHistory,
                    }
                }
            ]
        };
    }

    _messageControls = () => {
        return {
            type: 'div',
            props: {
                className: 'message-controls'
            },
            children: [
                {
                    type: 'div',
                    props: {
                        id: 'inputArea'
                    },
                    children: [
                        {
                            type: 'textarea',
                            props: {
                                id: 'messageInput',
                                placeholder: 'Type your message...',
                                disabled: !this.rtc.connected
                            }
                        }
                    ]
                },
                this._buttonsArea()
            ]
        };
    }

    _buttonsArea = () => {
        // const hasOpenChannel = Array.from(this.rtc.dataChannels.values()).some(channel => channel.readyState === 'open');
        console.log("_buttonsArea: this.rtc.connected=", this.rtc.connected);
        return {
            type: 'div',
            props: {
                id: 'buttonsArea',
            },
            children: [
                {
                    type: 'button',
                    props: {
                        id: 'attachButton',
                        className: 'btn',
                        title: (this.selectedFiles.length == 0 ? 'Attach files' : `${this.selectedFiles.length} file(s) attached`),
                        disabled: !this.rtc.connected,
                        text: (this.selectedFiles.length ? `📎(${this.selectedFiles.length})` : '📎'),
                        onClick: this._handleFileSelect
                    }
                },
                {
                    type: 'button',
                    props: {
                        id: 'sendButton',
                        className: 'btn',
                        disabled: !this.rtc.connected,
                        text: 'Send',
                        onClick: this._send
                    }
                },
                {
                    type: 'input',
                    props: {
                        id: 'fileInput',
                        type: 'file',
                        multiple: true,
                        style: 'display: none',
                        onChange: this._handleFiles
                    }
                }
            ]
        };
    }

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
        const messageDiv = dom.div(_, 'message');

        if (msg.sender === 'system') {
            messageDiv.classList.add('system');
            messageDiv.textContent = msg.content;
            return messageDiv;
        }

        // Create a container for the message header and content
        const messageContainer = dom.div(_, 'message-container');

        // Create a header container for sender and timestamp
        const messageHeader = dom.div(_, 'message-header');

        // Add sender prefix
        const senderSpan = dom.span(_, 'message-sender');

        if (msg.sender === this.rtc.userName) {
            messageDiv.classList.add('local');
            senderSpan.textContent = 'You';
        } else {
            messageDiv.classList.add('remote');
            senderSpan.textContent = msg.sender;
        }

        messageHeader.appendChild(senderSpan);

        // Add timestamp if available
        if (msg.timestamp) {
            const timestampSpan = dom.span(_, 'message-timestamp');

            // Format the timestamp
            const messageDate = new Date(msg.timestamp);
            const timeString = messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            timestampSpan.textContent = timeString;

            messageHeader.appendChild(timestampSpan);
        }

        // Create container for rendered markdown
        const messageContent = dom.div(_, 'message-content');

        // Render markdown content if there's any text message
        if (msg.content && msg.content.trim() !== '') {
            messageContent.innerHTML = util.renderContent(msg.content);
        }

        // Handle attachments if any
        if (msg.attachments && msg.attachments.length > 0) {
            const attachmentsDiv = dom.div(_, 'attachments');

            msg.attachments.forEach(attachment => {
                if (attachment.type.startsWith('image/')) {
                    // Display image inline
                    const imgContainer = dom.div(_, 'attachment-container');

                    const img = dom.img(_, 'attachment-image');
                    img.src = attachment.data;
                    img.alt = attachment.name;
                    img.style.maxWidth = '250px';
                    img.style.cursor = 'pointer';
                    img.title = "Click to view full size";

                    // View full size on click
                    img.onclick = (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        this.openImageViewer(attachment.data, attachment.name);
                        return false;
                    };

                    // Add download button for images
                    const downloadBtn = dom.button(_, 'download-button image-download');
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
                    const fileContainer = dom.div(_, 'file-attachment');

                    const fileIcon = dom.span('📄 ');
                    fileContainer.appendChild(fileIcon);

                    const fileName = dom.span(`${attachment.name} (${util.formatFileSize(attachment.size)})`);
                    fileContainer.appendChild(fileName);

                    const downloadButton = dom.button('Download', 'download-button');
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

        // Append both elements to the container
        messageContainer.appendChild(messageHeader);
        messageContainer.appendChild(messageContent);
        messageDiv.appendChild(messageContainer);

        return messageDiv;
    }

    // Modified display message function to use the common renderer
    _displayMessage = (msg) => {
        console.log("Displaying message from " + msg.sender + ": " + msg.content);
        const chatLog = dom.byId('chatLog');
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
        const chatLog = dom.byId('chatLog');
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
            const chatLog = dom.byId('chatLog');
            chatLog.innerHTML = '';

            // Display a system message
            const systemMsg = dom.div('Chat history has been cleared', 'message system');
            chatLog.appendChild(systemMsg);

            util.log('Cleared chat history for room: ' + this.rtc.roomId);
        }
    }

    _updateParticipantsList = () => {
        const list = dom.byId('participantsList');
        if (this.rtc.participants.size === 0) {
            list.textContent = 'QuantaChat: No participants yet';
        } else {
            list.textContent = 'QuantaChat with: ' + Array.from(this.rtc.participants).join(', ');
        }
    }

    // todo-0: this method will soon go away completely.
    _updateConnectionStatus = () => {
        // Enable input if we have at least one open data channel or we're connected to the signaling server
        const hasOpenChannel = Array.from(this.rtc.dataChannels.values()).some(channel => channel.readyState === 'open');
        const messageInput = dom.byId('messageInput');

        if (hasOpenChannel || this.rtc.connected) {
            messageInput.disabled = false;
        } else {
            messageInput.disabled = true;
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
        const fileInput = dom.byId('fileInput');
        fileInput.click();
    }

    // File input change handler
    _handleFiles = async () => {
        const fileInput = dom.byId('fileInput');
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
        }
        mr.refreshAll();
    }

    // Clear attachments after sending
    clearAttachments() {
        this.selectedFiles = [];
    }

    // Add this function to create and manage the image viewer modal
    createImageViewerModal() {
        console.log("createImageViewerModal called");
        // Create modal elements if they don't exist
        if (!dom.byId('image-viewer-modal')) {
            const modal = dom.div(_, 'image-viewer-modal')
            modal.id = 'image-viewer-modal';

            const modalContent = dom.div(_, 'modal-content');

            const closeBtn = dom.span(_, 'close-modal');
            closeBtn.innerHTML = '&times;';
            closeBtn.title = 'Close (Esc)';
            closeBtn.onclick = this.closeImageViewer;

            const imageElement = dom.img(_, 'modal-image');
            imageElement.id = 'modal-image';

            modalContent.appendChild(closeBtn);
            modalContent.appendChild(imageElement);
            modal.appendChild(modalContent);

            // Add click handler to close when clicking outside the image
            modal.onclick = (event) => {
                if (event.target === modal) {
                    this.closeImageViewer();
                }
            };

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

        const modal = dom.byId('image-viewer-modal');
        const modalImg = dom.byId('modal-image');

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
        const modal = dom.byId('image-viewer-modal');
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
        const downloadLink = dom.a();
        downloadLink.href = dataUrl;
        downloadLink.download = fileName;

        // Append to body, trigger click, then remove
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    }

    _connect = async () => {
        this.messages = null;
        console.log("Connecting to room: " + this.rtc.roomId);

        const usernameInput = dom.byId('username');
        const user = usernameInput.value.trim();

        const roomInput = dom.byId('roomId');
        const room = roomInput.value.trim();

        // if user or room is empty, return
        if (!user || !room) {
            alert('Please enter both username and room name');
            return;
        }

        await this.rtc._connect(user, room);
    }

    _disconnect = () => {
        this.messages = null;
        this.rtc._disconnect();
        this._updateParticipantsList();

        // Clear the chat log
        const chatLog = dom.byId('chatLog');
        chatLog.innerHTML = '';

        this.app._rtcStateChange();

        // Clear any selected files
        this.clearAttachments();
        util.log('Disconnected from chat');
    }

    _send = () => {
        const input = dom.byId('messageInput');
        const message = input.value.trim();
        this.rtc._sendMessage(message, this.selectedFiles);
        this.clearAttachments();
        input.value = '';
        mr.refreshAll();
    }
}

document.addEventListener('DOMContentLoaded', function () {
    console.log("calling initApp");
    const app = new QuantaChat();
    app.initApp();
});