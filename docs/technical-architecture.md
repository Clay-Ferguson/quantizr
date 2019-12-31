# Architecture Overview

## SpringBoot

Quantizr uses a SpringBoot back-end that provides a browser web app, and connects to a local MongoDB instance for storage. The back-end code is pure Java

## TypeScript

All of the front end browser code is in pure TypeScript, and no raw JavaScript

## ReactJS

React is used for all HTML rendering, and we use the non-JSX pure code-driven way of rendering HTML. There is no HTML templating therefore and all the ReactJS elements are done using "React Functional Components" and react hooks. Interestingly there actually *is* a component architecture that all the GUI elements are build from but when it comes time to render them it's all done using the pure react funcational way of doing that.

## MongoDB

MongoDB is used as the data storage of all nodes. The entire datbase itself is architected as one large tree structure of content. All user account data, system data, and everything else that is persisted is just done on this tree as tree nodes. (see Quantizr.java in the code)

## Docker

The app is packaged in a way that uses a Docker Container to host three separate docker processes, which all run out of the same docker instance:

1) The Quantizr App itself
2) MongoDB
3) IPFS Daemon

## IPFS

Quantizr has some experimental features using IPFS. The plan is to eventually make Quantizr able to read to and write to IPFS to become part of a distrubuted/decentralized (web3.0) network of Social Media apps, and other content platforms.

For details about IPFS see /docs/ipfs-browser.md

