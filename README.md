![Quanta Logo](branding/logo-250px-tr.jpg)

# Quanta Web Platform

[Live Instance: https://quanta.wiki](https://quanta.wiki)

Quanta is a new kind of Content Management platform, with powerful [features](https://quanta.wiki/n/features) including:

* [AI Chat & Agents](https://quanta.wiki/n/gpt-ai)
* Wikis & micro-blogging
* Document collaboration and publishing
* PDF Generation
* Secure messaging with (E2E Encryption)
* Video/audio recording & sharing
* File sharing
* Podcatcher (RSS Reader)
* Many other features related to managing hierarchical content

---

Create hierarchically organized content that's always editable like a wiki and shared online. Quanta is a new kind of platform with a new kind of architecture.

Designed to allow a more fine-grained hierarchical approach to content management, collaborative documents, wikis, and micro-blogs, Quanta "quantizes" each piece of content into tree nodes. 

These nodes are the main elements of the app, similar to Facebook Posts or Twitter Tweets. Quanta has a unique and more powerful design, allowing content to be organized into larger structures of information, to create arbitrary data structures representing documents, wikis, web pages, blogs, ChatGPT conversations, etc.

## Documentation

* [User Guide](https://github.com/Clay-Ferguson/quantizr/blob/master/docs/user-guide/index.md) 
* [Technical Guide](https://github.com/Clay-Ferguson/quantizr/blob/master/docs/technical-guide/index.md) 

## Technology Stack

* Java Language (back end) 
* TypeScript, ReactJS, Vite (front end)
* Spring Boot 3 FAT Jar with embedded Tomcat (back end)
* MongoDB as primary data store
* PostgreSQL for financial transaction storage
* Redis for Session Data
* Python Microservice using LangChain for AI functions
* Deployment: Docker Compose (Swarm Mode)

