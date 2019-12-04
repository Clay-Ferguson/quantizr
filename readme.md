# Quantizr WebApp

Quantizr is a content publishing/hosting platform where everything exists on a tree-structured database and each user owns a branch on this global tree which can be shared with other users. Each piece of data on the tree is called a "Node", and each node has it's own unique URL, and can markdown text (and/or images and arbitrary file attachments) and can be shared to specific other users or made public. A node can represent anything from a full document to just a paragraph, or even one sentence of content, and it's up to the user to create whatever they want and structure it as they want.

# Quantizr with IPFS

Experimental IPFS Connectivity is now working in Quantizr (not at quantizr.com yet). As a minimal proof-of-concept there is already the ability go crawl the IPFS MerkleDAG starting at some root point and then browse from there. This makes Quantizr able to become a fully functional "IPFS Browser". Quantizr will also function as a "full text search" over any and all content it has "crawled" in the IPFS network, because Quantizr caches all IPFS data it encounters into it's MongoDB and (this making data full-text searchable using the MongoDB/Lucene search technology). So Quantizr instances across the distributed web will each independently be able to function as a search engine for any amount of IPFS data that they choose to "crawl".

## Link to a live instance:

https://quantizr.com/r/public/home

## Sample Content (book): War and Peace

View this to see a demonstration of how browsing large structured documents works on the Quantizr platform.

https://quantizr.com/r/books/war-and-peace

## Sample Plugin: Podcast Reader

A simple podcast reader built on the Quantizr platform, implemented as a plugin.

https://quantizr.com/r/rss


# Tech-Stack Summary

## Back-end (Server Side)

* Java Language
* Spring Boot Web App
* Runs in embedded Tomcat
* Dockerfile provided (Docker Supported)
* REST-like Endpoint using ajax/JSON for all browser calls.
* MongoDB data storage (via. Mongo for Docker)
* IPFS File Access (via. GO-IPFS for Docker, experimental alpha, not much there)
* File System Index/Search (via Lucene+Tika)

## Browser (Client Side)

* Single Page Application (SPA)
* TypeScript Language: No hand-coded Javascript
* Bootstrap4 for layout/styling
* Webpack-generated single bundle JS file
* ReactJS-based HTML generation. Template-free architecture used (with functional React components)
* Ace Editor for Content Editing

## How to Build the App

See **/docs/getting-started.md**, which has very detailed information on how to install prerequisistes and build the app. 