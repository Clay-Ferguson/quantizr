![Quanta Logo](branding/logo-250px-tr.jpg)

# Quanta Web Platform

**Quanta is a Hierarchical CMS (Content Management System) **

Create hierarchically organized content that's always editable like a wiki and shared online. Quanta is a new kind of platform with a new kind of architecture.

Designed to allow a more fine-grained hierarchical approach to content management, collaborative documents, wikis, and micro-blogs, Quanta "quantizes" each piece of content into tree nodes. 

These nodes are the main elements of the app, similar to Facebook Posts or Twitter Tweets. Quanta has a unique and more powerful design, allowing content to be organized into larger structures of information, to create arbitrary data structures representing documents, wikis, web pages, blogs, ChatGPT conversations, etc.

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

## Notes

The `QuantaGradio` folder in this repo has it's own `README.md` and contains several Python-based Gradio apps for doing AI (General Chatbot, Coding Agent Chatbox, Image Understanding, and Image Generation), and relies on the same Python in the `commmon` folder, however these Gradio apps are not actually a part of Quanta itself, and the `QuantaGradio` project can be completely omitted if you're only interested in Quanta CMS Web app.

