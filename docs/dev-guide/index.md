**[Quanta](/docs/index.md)**

* [Quanta Technical Docs](#quanta-technical-docs)
    * [High Level Architecture](#high-level-architecture)
        * [Docker Compose File Services](#docker-compose-file-services)
            * [Quanta](#quanta)
            * [QAI](#qai)
            * [Redis](#redis)
            * [MongoDB](#mongodb)
            * [PostgreSQL](#postgresql)
            * [PGAdmin](#pgadmin)
    * [App Flow](#app-flow)
    * [AI Notes](#ai-notes)
        * [About AI Cloud Services HTTP Calls](#about-ai-cloud-services-http-calls)

# Quanta Technical Docs

This section is for software developers who will be working on the Quanta code and/or admins deploying an instance of the platform.

# High Level Architecture

## Docker Compose File Services

We use docker compose yaml as the primary deployment artifact and deploy the app to a docker swarm (Docker needs to be running in swarm mode).  Below are the individual services in the docker compose files:

### Quanta

This is the web app itself.

### QAI

This service is the AI microservice. The Quanta app communicates to it via REST /HTTP interface. Internally this microservice uses Python and LangChain to provide AI services.

### Redis

Session data is stored in Redis instead of being managed by Quanta app itself, so that when necessary multiple swarm nodes of Quanta can be run for larger deployments.

### MongoDB

This runs the MongoDB instance, which is the main database for the app. There is only one `collection` in the DB which represents a `Tree Structure`. There is a `path` property in each Document (i.e. DB Record) which is how the tree structure is stored.

### PostgreSQL

Runs the PosgreSQL database instance. For any information that doesn't make sense to store on the main `Tree` structure of the app, we will put in the PostgreSQL database. Currently the only information stored in Postgre is the financial transactions related to the payments and usage of AI services. To allow users to consume as much AI usage from the AI Cloud providers (OpenAI, Anthropic, Perplexity, etc) as they want, in an unlimited way, we let users add credit into their own accounts, and then they're essentially spending their own money as they use the AI. The Quanta website doesn't charge extra for memberships or services.

### PGAdmin

This is a service that runs the PG Admin console where the PostgreSQL database can be managed from just for admin purposes.

# App Flow

When someone accesses the site they're automatically sent to the automatically generated node with the path `/r/public/home`. This node represents the main landing page for the app and is owned by the `admin` user. The admin user's password is fed into the app thru the docker-compose.yaml file.

When a user is signed in and they open the app they'll be directed to their account root node. Every user has a private account root node.

### [Docker-Install](/docs/dev-guide/docker-install.md)

### [How-to-Build](/docs/dev-guide/how-to-build.md)

### [How-to-Run](/docs/dev-guide/how-to-run.md)

### [PostgreSQL](/docs/dev-guide/postgres.md)

# AI Notes

## About AI Cloud Services HTTP Calls

Currently we use direct HTTP calls to the various AI Cloud providers that we support rather than going thru a Java wrapper library. The reason for this because this app was written before there were any good Java AI libraries. As of the time of this writing (6/26/24) there are actually two choices that we could use which are 1) Spring AI and 2) LangChain4J. However the Spring AI is still in early development so it's not a viable choice. I'd prefer to use Spring rather than any other non-Spring library too. So I will wait several more months, or up to a year to see which one (Spring AI vs LangChain4J) ends up being the best choice, and my hunch is that I'll likely opt for Spring.

### [Troubleshooting](/docs/dev-guide/troubleshooting.md)


----
**[Next: Docker-Install](/docs/dev-guide/docker-install.md)**
