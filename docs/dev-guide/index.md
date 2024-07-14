**[Quanta](/docs/index.md)**

# Quanta Developer Guide

This section is for software developers who will be working on the Quanta code and/or deploying an instance of the platform.

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
