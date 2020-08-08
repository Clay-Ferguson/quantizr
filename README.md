![Quanta Logo](https://quanta.wiki/images/eagle-logo-250px-tr.jpg)

# Quanta WebApp

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


## How to Build the App

See **/docs/getting-started.md**, which has very detailed information on how to install prerequisistes and build the app. 