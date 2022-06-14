![Quanta Logo](https://quanta.wiki/branding/logo-250px-tr.jpg)

# Quanta Web Platform

### Content Mangement, Micro Blogging, and Social Media

Welcome to the Fediverse!

Quanta is a new kind of social media and content management platform. Connect to the Fediverse with unique and powerful features like wikis, micro-blogging, document collaboration, conversation threads, encrypted secure messaging, video/audio recording & sharing, file sharing, a podcatcher, and much more.

Create hierarchically organized content that's always editable like a wiki and shared on the Fediverse and/or IPFS. Quanta is a new kind of platform with a new kind of architecture where you always have complete control of your own data.

Designed to allow a more fine-grained hierarchical approach to content management, collaborative documents, wikis, and micro-blogs, Quanta "quantizes" each piece of content into tree nodes. These nodes are the main elements of the app, similar to Facebook Posts or Twitter Tweets. Quanta has a unique and more powerful design, allowing content to be organized into larger structures of information, to create arbitrary data structures representing documents, wikis, web pages, blogs, etc.

The following test instance is open to the public, so anyone can sign up and browse the Fediverse:

https://quanta.wiki

## How to Build/Deploy

See [./distro/README.md](./distro/README.md) for details on how to build and/or run a Quanta instance. 

Quanta is a browser-based SPA (Single Page App), that works on both mobile and desktop browsers. 

The languages and tech stack is as follows: Java Language, SpringBoot FAT Jar with embedded Tomcat on back end, TypeScript & Bootstrap (CSS), ReactJS+Redux front end. Deployed and installed via docker (docker compose), MongoDB as the data store, as well as the GO Lang version of IPFS.

## WARNING to VSCode Users

Starting with version 1.68, VSCode apparently added new more strict error checking making lines like the following now be considered an error:

```
myVar: MyType = null;
```
whereas they think the "correct" code is this:

```
myVar: MyType | null = null;
```

I'm hoping I can find a linter setting to disable this checking becasue this makes tens of thousands of lines of this project get reported as errors that absolutely should not, in my opinion. Pretty much everywhere I'm using a null is reported as an error in version 1.68, because I have 100% TypeSafe code and VSCode has decided nulls are no longer by default safe to assign to a typed object! Completely insane.


## Project Funding

Help support this project by making a financial contribution here: [Contribute to Quanta](https://www.paypal.com/donate/?hosted_button_id=4S3DEDU4BLYEW)

## Search Tags

Social Media Platform, Decentralized, Fediverse, IPFS, ActivityPub, Web3.0, Mastodon/Pleroma, IPFS, MongoDB, docker compose, Java, TypesScript, ReactJS, HTML+SCSS, SpringBoot, Podcasting, RSS, Encrpytion, E2E Encryption, Secure Messaging, Blogging Platform, Wikis, CMS, Corporate Collaboration, Full-Text search, Lucene