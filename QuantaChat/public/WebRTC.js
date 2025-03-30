import Utils from './Util.js';
const util = Utils.getInst();

/**
 * WebRTC class for handling WebRTC connections
 * Designed as a singleton that can be instantiated once and reused
 */
class WebRTC {
    peerConnections = new Map();
    dataChannels = new Map();
    socket = null;
    roomId = "";
    userName = "";
    participants = new Set();
    connected = false;
    storage = null;
    app = null;

    constructor() {
        console.log('WebRTC singleton created');
    }

    // New static factory method to replace async constructor
    static async getInst(storage, app) {
        // Create instance if it doesn't exist
        if (!WebRTC.inst) {
            WebRTC.inst = new WebRTC();
            await WebRTC.inst.init(storage, app);
        }
        return WebRTC.inst;
    }

    async init(storage, app) {
        this.storage = storage;
        this.app = app;
    }

    initRTC() {
        util.log('Starting WebRTC connection setup...');

        // Create WebSocket connection to signaling server. 
        let url = `ws://${RTC_HOST}:${RTC_PORT}`;
        console.log('Connecting to signaling server at ' + url);
        this.socket = new WebSocket(url);
        this.socket.onopen = this._onopen;
        this.socket.onmessage = this._onmessage;
        this.socket.onerror = this._onerror;
        this.socket.onclose = this._onclose;
    }

    _onmessage = (event) => {
        const evt = JSON.parse(event.data);

        // Handle room information (received when joining)
        if (evt.type === 'room-info') {
            util.log('Room info received with participants: ' + evt.participants.join(', '));

            // Update our list of participants
            this.participants = new Set(evt.participants);
            this.app._updateParticipantsList();

            // For each participant, create a peer connection and make an offer
            evt.participants.forEach(participant => {
                if (!this.peerConnections.has(participant)) {
                    this.createPeerConnection(participant, true);
                }
            });
        }

        // Handle user joined event
        else if (evt.type === 'user-joined') {
            util.log('User joined: ' + evt.name);
            this.participants.add(evt.name);
            this.app._updateParticipantsList();

            // todo-: these messages are not being displayed
            const msg = this.createMessage(evt.name + ' joined the chat', 'system');
            this.app._displayMessage(msg);

            // Create a connection with the new user (we are initiator)
            if (!this.peerConnections.has(evt.name)) {
                this.createPeerConnection(evt.name, true);
            }
        }

        // Handle user left event
        else if (evt.type === 'user-left') {
            util.log('User left: ' + evt.name);
            this.participants.delete(evt.name);
            this.app._updateParticipantsList();

            const msg = this.createMessage(evt.name + ' left the chat', 'system');
            this.app._displayMessage(msg);

            // Clean up connections
            if (this.peerConnections.has(evt.name)) {
                this.peerConnections.get(evt.name).close();
                this.peerConnections.delete(evt.name);
            }

            if (this.dataChannels.has(evt.name)) {
                this.dataChannels.delete(evt.name);
            }

            this.app._updateConnectionStatus();
        }

        // Handle WebRTC signaling messages
        else if (evt.type === 'offer' && evt.sender) {
            util.log('Received offer from ' + evt.sender);

            // Create a connection if it doesn't exist
            let pc;
            if (!this.peerConnections.has(evt.sender)) {
                pc = this.createPeerConnection(evt.sender, false);
            } else {
                pc = this.peerConnections.get(evt.sender);
            }

            pc.setRemoteDescription(new RTCSessionDescription(evt.offer))
                .then(() => pc.createAnswer())
                .then(answer => pc.setLocalDescription(answer))
                .then(() => {
                    this.socket.send(JSON.stringify({
                        type: 'answer',
                        answer: pc.localDescription,
                        target: evt.sender,
                        room: this.roomId
                    }));
                    util.log('Sent answer to ' + evt.sender);
                })
                .catch(error => util.log('Error creating answer: ' + error));
        }

        else if (evt.type === 'answer' && evt.sender) {
            util.log('Received answer from ' + evt.sender);
            if (this.peerConnections.has(evt.sender)) {
                this.peerConnections.get(evt.sender)
                    .setRemoteDescription(new RTCSessionDescription(evt.answer))
                    .catch(error => util.log('Error setting remote description: ' + error));
            }
        }

        else if (evt.type === 'ice-candidate' && evt.sender) {
            util.log('Received ICE candidate from ' + evt.sender);
            if (this.peerConnections.has(evt.sender)) {
                this.peerConnections.get(evt.sender)
                    .addIceCandidate(new RTCIceCandidate(evt.candidate))
                    .catch(error => util.log('Error adding ICE candidate: ' + error));
            }
        }

        // Handle broadcast messages
        else if (evt.type === 'broadcast' && evt.sender) {
            util.log('broadcast. Received broadcast message from ' + evt.sender);
            this.app._persistMessage(evt.message);
            this.app._displayMessage(evt.message);
        }
    }

    _onopen = () => {
        util.log('Connected to signaling server.');
        this.connected = true;
        this.app._updateConnectionStatus();

        // Join a room with user name
        this.socket.send(JSON.stringify({
            type: 'join',
            room: this.roomId,
            name: this.userName
        }));
        util.log('Joining room: ' + this.roomId + ' as ' + this.userName);
    }

    _onerror = (error) => {
        util.log('WebSocket error: ' + error);
        this.connected = false;
        this.app._updateConnectionStatus();
    };

    _onclose = () => {
        util.log('Disconnected from signaling server');
        this.connected = false;

        // Clean up all connections
        this.peerConnections.forEach(pc => pc.close());
        this.peerConnections.clear();
        this.dataChannels.clear();

        this.app._updateConnectionStatus();
    }

    createPeerConnection(peerName, isInitiator) {
        util.log('Creating peer connection with ' + peerName + (isInitiator ? ' (as initiator)' : ''));

        const pc = new RTCPeerConnection();
        this.peerConnections.set(peerName, pc);

        // Set up ICE candidate handling
        pc.onicecandidate = event => {
            if (event.candidate) {
                this.socket.send(JSON.stringify({
                    type: 'ice-candidate',
                    candidate: event.candidate,
                    target: peerName,
                    room: this.roomId
                }));
                util.log('Sent ICE candidate to ' + peerName);
            }
        };

        // Connection state changes
        pc.onconnectionstatechange = () => {
            util.log('Connection state with ' + peerName + ': ' + pc.connectionState);
            if (pc.connectionState === 'connected') {
                util.log('WebRTC connected with ' + peerName + '!');
                this.app._updateConnectionStatus();
            } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                util.log('WebRTC disconnected from ' + peerName);
                this.app._updateConnectionStatus();
            }
        };

        // Handle incoming data channels
        pc.ondatachannel = event => {
            util.log('Received data channel from ' + peerName);
            this.setupDataChannel(event.channel, peerName);
        };

        // If we're the initiator, create a data channel
        if (isInitiator) {
            try {
                util.log('Creating data channel as initiator for ' + peerName);
                const channel = pc.createDataChannel('chat');
                this.setupDataChannel(channel, peerName);

                // Create and send offer
                pc.createOffer()
                    .then(offer => pc.setLocalDescription(offer))
                    .then(() => {
                        this.socket.send(JSON.stringify({
                            type: 'offer',
                            offer: pc.localDescription,
                            target: peerName,
                            room: this.roomId
                        }));
                        util.log('Sent offer to ' + peerName);
                    })
                    .catch(error => util.log('Error creating offer: ' + error));
            } catch (err) {
                util.log('Error creating data channel: ' + err);
            }
        }
        return pc;
    }

    // Underscore at front of method indicates it's permanently locked to 'this' and thus callable from event handlers.
    _connect = async (userName, roomId) => {
        this.userName = userName;
        this.roomId = roomId;

        await this.storage.setItem('username', this.userName);
        await this.storage.setItem('room', this.roomId);
        await this.app.displayRoomHistory(this.roomId);

        // If already connected, reset connection with new name and room
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            // Clean up all connections
            this.peerConnections.forEach(pc => pc.close());
            this.peerConnections.clear();
            this.dataChannels.clear();

            // Rejoin with new name and room
            this.socket.send(JSON.stringify({
                type: 'join',
                room: this.roomId,
                name: this.userName
            }));
            util.log('Joining room: ' + this.roomId + ' as ' + this.userName);
        } else {
            this.initRTC();
        }
    }

    _disconnect = () => {
        // Close the signaling socket
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.close();
        }

        // Clean up all connections
        this.peerConnections.forEach(pc => pc.close());
        this.peerConnections.clear();
        this.dataChannels.clear();

        // Reset participants
        this.participants.clear();
        this.connected = false;
    }

    setupDataChannel(channel, peerName) {
        util.log('Setting up data channel for ' + peerName);
        this.dataChannels.set(peerName, channel);

        channel.onopen = () => {
            util.log('Data channel open with ' + peerName);
            this.app._updateConnectionStatus();
        };

        channel.onclose = () => {
            util.log('Data channel closed with ' + peerName);
            this.dataChannels.delete(peerName);
            this.app._updateConnectionStatus();
        };

        channel.onmessage = (event) => {
            util.log('onMessage. Received message from ' + peerName);
            try {
                const msg = JSON.parse(event.data);
                this.app._persistMessage(msg);
                this.app._displayMessage(msg);
            } catch (error) {
                util.log('Error parsing message: ' + error);
            }
        };

        channel.onerror = (error) => {
            util.log('Data channel error with ' + peerName + ': ' + error);
            this.app._updateConnectionStatus();
        };
    }

    createMessage(content, sender, attachments = []) {
        const msg = {
            timestamp: new Date().toISOString(),
            sender,
            content,
            attachments
        };
        return msg;
    }

    // Send message function (fat arrow makes callable from event handlers)
    _sendMessage = (message, selectedFiles) => {
        if (message || selectedFiles.length > 0) {
            util.log('Sending message with ' + selectedFiles.length + ' attachment(s)');

            const msg = this.createMessage(message, this.userName, selectedFiles);
            this.app._persistMessage(msg);
            this.app._displayMessage(msg);

            // Try to send through data channels first
            let channelsSent = 0;
            this.dataChannels.forEach((channel, peer) => {
                if (channel.readyState === 'open') {
                    channel.send(JSON.stringify(msg));
                    channelsSent++;
                }
            });

            // If no channels are ready or no peers, send through signaling server
            if ((channelsSent === 0 || this.participants.size === 0) &&
                this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({
                    type: 'broadcast',
                    message: msg,
                    room: this.roomId
                }));
                util.log('Sent message via signaling server');
            }
        }
    }
}

export default WebRTC;