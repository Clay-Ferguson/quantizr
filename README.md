![Quanta Logo](branding/logo-250px-tr.jpg)

# Quanta Web Platform

**Quanta is a Hierarchical CMS (Content Management System) **

Create hierarchically organized content that's always editable like a wiki and shared online. Quanta is a new kind of platform with a new kind of architecture.

Designed to allow a more fine-grained hierarchical approach to content management, collaborative documents, wikis, and micro-blogs, Quanta "quantizes" each piece of content into tree nodes. 

These nodes are the main elements of the app, similar to Facebook Posts or Twitter Tweets. Quanta has a unique and more powerful design, allowing content to be organized into larger structures of information, to create arbitrary data structures representing documents, wikis, web pages, blogs, ChatGPT conversations, etc.


## WARNING (This entire project is deprecated)

**IMPORTANT Note from the developer (Clay Ferguson):**
This project evolved over many years (well over a decade) as my one and only side project. However as of around 2023 I abandoned this project, for the following reasons:

* To stop doing Java Development, and work only in TypeScript and Python going forward.
* To move away from NoSQL (MongoDB) and move back to SQL/RDBMS (PostgreSQL)
* To go back to standard JSX/TSX-based React rather than the Pure-JS (no JSX/TSX) architecture in this application.
* I also realized I could recreate a new version of this application, addressing all of these technical issues, using an AI Agent to do all the work — and so that's what I did. I created the [Quanta](https://github.com/Clay-Ferguson/quanta) project which is almost 100% AI Generated, which became the replacement for this project (Quantizr). That also means this project is essentially the last handwritten code done I've ever worked on, and this project is the only project on my GitHub account that isn't 100% written by AI. Every other project on my Github is written entirely by AI.


## Features

* Block-based Editor (similar to Jypyter Notebooks)
* AI Chat & Agents
* Wikis & micro-blogging
* Document collaboration and publishing
* PDF Generation
* Secure messaging with (E2E Encryption)
* Video/audio recording & sharing
* File sharing
* Podcatcher (RSS Reader)
* Many other features related to managing hierarchical content

## Documentation

* [User Guide](https://clay-ferguson.github.io/quantizr/user-guide) 
* [Technical Guide](https://clay-ferguson.github.io/quantizr/technical-guide/index.html) 

## Technology Stack

* TypeScript, ReactJS, TailwindCSS, Vite Build (front end)
* Java Spring Boot 3 FAT Jar with embedded Tomcat (back end)
* MongoDB as database
* Redis for session data
* Python Microservice using LangChain for AI functions
* Deployment: Docker Compose (Swarm Mode)

## Quantizr is a Mono-Repo

Quantizr is a mono-repo that is itself (at the root level) the Quanta Web App (CMS), which is a very large app with around 500K lines of code. However inside the root folder we have two separate projects which are standalone applications themselves, and can be run independently of Quanta. These two separate apps are:

**Quanta Web App (CMS)**

The root level of the repository contains the Quanta App itself.


**Quanta Gradio App**

The `QuantaGradio` folder in this repo contains several Python-based Gradio apps for doing AI (General Chatbot, Coding Agent Chatbox, Image Understanding, and Image Generation), and relies on the same Python in the `commmon` folder. So to use QuantaGradio apps you only need to checkout the `QuantaGradio` and `common` folders.

