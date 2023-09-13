![Quanta Logo](https://quanta.wiki/branding/logo-250px-tr.jpg)

# Quanta Web Platform

![Search Example](https://quanta.wiki/f/id/64fd056ed4bf7b4da17cf55d)

## A new Kind of CMS with ChatGPT and Social Media features

Quanta is a new kind of [Social Media](https://quanta.wiki/?view=feed) and Content Management platform, with powerful [features](https://quanta.wiki/n/features) including:

* wikis & micro-blogging
* [ChatGPT Question Answering](https://quanta.wiki/n/gpt-ai)
* document collaboration and publishing
* PDF Generation
* secure messaging with (E2E Encryption)
* video/audio recording & sharing
* file sharing
* podcatcher (RSS Reader)
* plus about 100 more features!

## Hierarchical Content

Create hierarchically organized content that's always editable like a wiki and shared on the Fediverse and/or IPFS. Quanta is a new kind of platform with a new kind of architecture.

Designed to allow a more fine-grained hierarchical approach to content management, collaborative documents, wikis, and micro-blogs, Quanta "quantizes" each piece of content into tree nodes. 

These nodes are the main elements of the app, similar to Facebook Posts or Twitter Tweets. Quanta has a unique and more powerful design, allowing content to be organized into larger structures of information, to create arbitrary data structures representing documents, wikis, web pages, blogs, ChatGPT conversations, etc.

## Take it for a Test Drive

The [Quanta Dev Instance](https://quanta.wiki) is open to the public, so anyone can try it out. If you're interested in [Social Media](https://quanta.wiki/?view=feed) you might like the [Trending Tab](https://quanta.wiki/?view=trending) as well.

Quanta is a browser-based app that works on both mobile and desktop browsers, although it's optimized for desktop.

## Technology Stack

* Java Language (back end) 
* SpringBoot FAT Jar with embedded Tomcat (back end)
* TypeScript, ReactJS, Vite (front end)
* Bootstrap & SCSS
* Deployer: Docker (docker compose)
* MongoDB as the primary data store
* Redis for Session Data
* IPFS Gateway
* ChatGPT (via OpenAI API)

## To Run the Server

Edit `/distro/setenv-run-distro.sh` to define your environment settings, and point the docker IMAGE name to Docker Hub. Then run `/distro/run-distro.sh`, which will startup a Docker Compose Swarm with one replica. All the defaults in the `setenv` file should probably work as is (port numbers, folder names, etc), but you do need to set the docker image names `DOCKER_IMAGE` to point to Docker Hub, unless you've already built locally and can just point to your local images.

## Help Fund the Project

[Send Money via PayPal](https://PayPal.me/WILLIAMCFERGUSON) directly to the developer.

## Keywords

ChatGPT, GPT-4, AI, Machine Learning, LLM, Large Language Model, OpenAI, Meta, Decentralized, Social Media, Fediverse, ActivityPub, Mastodon/Pleroma, Web3.0, IPFS, File Sharing, MongoDB, Redis, docker swarm, Java, Javascript, TypesScript, React, HTML+SCSS, SpringBoot, Podcasting, RSS, E2E Encryption, Secure Messaging, Blogging, Wikis, CMS, Collaboration, Full-Text search, Lucene