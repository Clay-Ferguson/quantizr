# About QuantaChat

## [Try QuantaChat Now! --> http://chat.quanta.wiki](http://chat.quanta.wiki)


### Peer-to-Peer WebRTC-based Chat/Messaging Web App in pure JavaScript using a Single HTML file design.

This project is intended to be the simplest possible implementation of a usable **Chat App** (i.e. chat messaging system) that can be done with just plain JavaScript using WebRTC. 

The idea is that, as long as the QuantaChatServer (a simple WebRTC Signaling Server) is running on the web, then multiple parties will be able to have the ability to chat (send messages) in realtime in a way that's completely browser-to-browser (i.e. peer-to-peer) without any server in between that could be watching or managing messages. In other words, the QuantaChatServer is only used to allow each web browser (Chat App Client) to locate other chat participants, but the server plays no role in the communications.

We support any number of users to be in a chat room simultaneously, and any number of different chat rooms can also be running at the same time.


# Features

* Basic chat room with a scrolling window of messages from all participants in the room.
* Anyone can join any room using any name 
* Messages can be simple text or text and file attachments
* Markdown is supported in message text
* File attachments that are images are of course displayed in the GUI
* Attached images can be clicked on to get an enlarged view
* All attached files are downloadable (making this app able to function as a rudamentary "File Sharing App")
* All local storage is kept in your browsers storage space, private to your browser, but there's a "Clear" button you can use to wipe out your entire copy of an entire chat room that you or anyone else created. (Note: This only clears your own personal copy of the chat room)
* For ease of use you can create a shortcut like `http://chat.quanta.wiki/?user=bob&room=sports`, which has the username and room name embedded in the url and will automatically connect you to that room, when you visit the url.
* Technical Note: The data for chat rooms is saved using the `IndexedDB` API feature in Web Browsers, so the amount of storage allowed will currently be determined by the limitations of that storage space.

## Caveats/Warnings

* There's currently no security or encryption or control over rooms. Anyone can join any room, using any name they want, and there's no way to control who is allowed to participate in any room. Everything is fully public. If you want to have a truly "private" chat, however you can just use a room name that's un-guessable, and that will provide basic privacy, but the app is a work in progress, and actual security may be added later.


# How it Works (Technical)

## The Server

The command shown below starts the `QuantaChatServer` which is a very tiny web server with just two simple purposes 1) To serve the `QuantaChat.html` (the app) and 2) To run as a `Signaling Server` which allows the clients/peers/browses to find each other, which happens automatically.

## The Chat Client

The chat client itself is very simple. It allows users to enter their username and a chat room name, and then click "Connect" button, to join that room. Rooms are automatically created once they're needed by someone. The room's history of chat message is kept only on the peers (clients) and is saved in browser local storage. None of the messages are ever seen by the server, because they're sent directly to the browsers of the people in the room.

If you refresh the browser you'll need to click "Connect" again to resume, but the chat room's history will still be there. Note, however that since this is a peer-to-peer system (with no central storage or database) any conversations that happen in a room while you're not online and in that room, will not be visible to you. There's currently no strategy for syncing messages `across` all users that have ever participated in a room. This could be a potential future feature.


# Why no Web Frameworks?

You'll notice this app has no Vue, React, Angular, or any other web frameworks, and is implemented entirely in pure JavaScript. This was done very intentionally to keep this code understandable and usable by all JavaScript developers. This app was sort of done as an experiment also just to prove what the simplest possible implementation of Chat App can look like. It would be a great app for JavaScript beginners to learn with, or for developers wanting to learn about WebRTC as well. 


# Download code from GitHub

You only need the `QuantaChat` folder (from the `quantizr` mono-repo), so use Git sparse checkout:

1.  Clone the monorepo:
    ```bash
    git clone --sparse https://github.com/Clay-Ferguson/quantizr
    cd quantizr
    ```
2.  Configure sparse checkout:
    ```bash
    git sparse-checkout init --cone
    git sparse-checkout set QuantaChat
    ```
3.  Checkout the main branch:
    ```bash
    git checkout main
    ```
4.  Prepare to Run
    ```bash
    cd QuantaChat
    npm install
    ```

Now, the QuantaChat project will be available in the `QuantaChat` directory. To update, simply run `git pull`.    
    

# Starting the Server

You'll need to install Node and NPM first. Then one of the following two options below:

To run on localhost, for testing (port 8000 for HTTP, port 8080 for WebRTC).

    node QuantaChatServer.js

To run on a productin server:

    sudo node QuantaChatServer.js --host 12.34.56.78 --port 8080 --httpPort 80

