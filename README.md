![Quanta Logo](https://quanta.wiki/images/eagle-logo-250px-tr.jpg)

# Quanta Web Platform

Welcome to the Fediverse! Join the Fediverse!

Quanta is a new kind of decentralized and federated social media platform. Connect to the Fediverse with unique and powerful features like wikis, blogging, document collaboration, conversation threads, encrypted secure messaging, video/audio recording & sharing, file sharing, a podcatcher, and much more.

Create hierarchically organized content text, documents, images, audio and video that's always editable, shareable on the Fediverse, and saved on IPFS.

Quanta is a content publishing/hosting platform where everything exists on a tree-structured database and each user owns a branch on this global tree which can be shared with other users. Each piece of data on the tree is called a "Node", and each node has it's own unique URL, and can markdown text (and/or images and arbitrary file attachments) and can be shared to specific other users or made public. A node can represent anything from a full document to just a paragraph, or even one sentence of content, and it's up to the user to create whatever they want and structure it as they want.

## Live test instance:

https://quanta.wiki

# Tech-Stack Summary

## Back-end (Server Side)

* Java Language
* Spring Boot Web App
* Runs in embedded Tomcat
* REST-like Endpoint using ajax/JSON for all browser calls.
* MongoDB data storage (via. Mongo for Docker)
* IPFS File Access (supports uploading files to IPFS)
* File System Index/Search (via Lucene+Tika)
* Dockerfile Compose files for deployment

## Browser (Client Side)

* Single Page Application (SPA)
* TypeScript Language
* Bootstrap 4 for layout/styling
* Webpack-generated single bundle JS file
* ReactJS with Redux 
* Ace Editor for Content Editing
* MathJax for rendering Latex math formulas
* NPM rss-parser Package

## Fun Links to get you started

#### [Demo Videos showing Quanta platform in action](https://quanta.wiki/n/screencast)

#### [A curated Fediverse Feed - Some News Bots, some people](https://quanta.wiki/app?tab=feed)

#### [RSS New Feeds - Curated Aggregate](https://quanta.wiki/n/news)

#### [Podcasts - Curated Aggregate](https://quanta.wiki/n/podcasts)

## How to Build the App

https://quanta.wiki/n/technical-notes

## Search Tags

Social Media Platform, Decentralized, Fediverse, IPFS, ActivityPub, Web3.0, Mastodon/Pleroma, IPFS, MongoDB, docker compose, Java, TypesScript, ReactJS, HTML+SCSS, SpringBoot, Podcasting, RSS, Encrpytion, E2E Encryption, Secure Messaging, Blogging Platform, Wikis, Corporate Collaboration, Full-Text search, Lucene