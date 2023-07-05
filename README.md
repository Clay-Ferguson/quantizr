![Quanta Logo](https://quanta.wiki/branding/logo-250px-tr.jpg)

# Quanta Web Platform

### A new Kind of Content Management, with Social Media support
 
Welcome to the Fediverse!

Quanta is a new kind of Social Media and Content Management platform, with uniquely powerful features for wikis, micro-blogging, document collaboration and publishing, secure messaging with (E2E Encryption), video/audio recording & sharing, file sharing, a podcatcher, and much more. Fediverse (Social Media) support includes both ActivityPub and Nostr Protocols.

Create hierarchically organized content that's always editable like a wiki and shared on the Fediverse and/or IPFS. Quanta is a new kind of platform with a new kind of architecture where you always have complete control of your own data.

Designed to allow a more fine-grained hierarchical approach to content management, collaborative documents, wikis, and micro-blogs, Quanta "quantizes" each piece of content into tree nodes. These nodes are the main elements of the app, similar to Facebook Posts or Twitter Tweets. Quanta has a unique and more powerful design, allowing content to be organized into larger structures of information, to create arbitrary data structures representing documents, wikis, web pages, blogs, etc.

The following test instance is open to the public, so anyone can sign up and browse the Fediverse:

https://quanta.wiki

Quanta is a browser-based SPA (Single Page App), that works on both mobile and desktop browsers. 

The languages and tech stack is as follows: Java Language, SpringBoot FAT Jar with embedded Tomcat on back end, TypeScript & Bootstrap (CSS), ReactJS front end. Deployed and installed via docker (docker compose), MongoDB as the primary data store, and an option for running an IPFS Gateway.

### To Run the Server

Edit `/distro/setenv-run-distro.sh` to define your environment settings, and point the docker IMAGE name to Docker Hub. Then run `/distro/run-distro.sh`, which will startup a Docker Compose Swarm with one replica. All the defaults in the `setenv` file should probably work as is (port numbers, folder names, etc), but you do need to set the docker image names (`DOCKER_IMAGE` and `TSERVER_IMAGE`) to point to Docker Hub, unless you've already built locally and can just point to your local images.

### Keywords

Decentralized, Social Media, Fediverse, ActivityPub, Nostr, Mastodon/Pleroma, Web3.0, IPFS, File Sharing, MongoDB, Redis, docker swarm, Java, Javascript, TypesScript, React, HTML+SCSS, SpringBoot, Podcasting, RSS, E2E Encryption, Secure Messaging, Blogging, Wikis, CMS, Collaboration, Full-Text search, Lucene