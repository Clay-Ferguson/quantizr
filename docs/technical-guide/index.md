# Quanta Technical Docs

* [High Level Architecture](#high-level-architecture)
    * [Docker Compose File Services](#docker-compose-file-services)
        * [Quanta](#quanta)
        * [QAI](#qai)
        * [Redis](#redis)
        * [MongoDB](#mongodb)
        * [PostgreSQL](#postgresql)
        * [PGAdmin](#pgadmin)
* [App Flow](#app-flow)
* [Docker Install](#docker-install)
    * [How to Install Docker Compose](#how-to-install-docker-compose)
    * [Prerequisite](#prerequisite)
    * [Installing Docker](#installing-docker)
    * [Allow Docker Command without Sudo](#allow-docker-command-without-sudo)
    * [Installing Docker Compose](#installing-docker-compose)
    * [Put Docker in Swarm Mode](#put-docker-in-swarm-mode)
* [How to Build](#how-to-build)
    * [Front-End Notes](#front-end-notes)
        * [About Yarn](#about-yarn)
    * [How to Build Quanta - Dev Mode](#how-to-build-quanta---dev-mode)
    * [Front-end Hot Deploy](#front-end-hot-deploy)
    * [Back-end Hot Deploy](#back-end-hot-deploy)
    * [Production Builds](#production-builds)
* [How to Run](#how-to-run)
    * [How to Run the Quanta Server](#how-to-run-the-quanta-server)
    * [Step 1 - Install Docker](#step-1---install-docker)
    * [Step 2 - Docker Swarm Mode](#step-2---docker-swarm-mode)
    * [Step 3 - Make Runtime Folder](#step-3---make-runtime-folder)
    * [Step 4 - Start and Stop the app](#step-4---start-and-stop-the-app)
    * [Note 1](#note-1)
    * [Note 2](#note-2)
* [PostgreSQL](#postgresql)
    * [PostgreSQL Notes](#postgresql-notes)
    * [Postgre Docker Compose](#postgre-docker-compose)
    * [Postgre Admin](#postgre-admin)
* [AI Notes](#ai-notes)
    * [About AI Cloud Services HTTP Calls](#about-ai-cloud-services-http-calls)
* [Troubleshooting](#troubleshooting)
    * [Healthcheck Results](#healthcheck-results)
    * [Realtime Monitoring Console ](#realtime-monitoring-console-)
    * [Check to see what Docker has Running](#check-to-see-what-docker-has-running)
    * [Check Docker Images](#check-docker-images)
    * [Inspect your Docker Repository](#inspect-your-docker-repository)
    * [Check Docker Logs](#check-docker-logs)
    * [Delete all Images](#delete-all-images)
    * [To Remove Most Running things](#to-remove-most-running-things)
    * [To Cleanup Disk Space](#to-cleanup-disk-space)
    * [Docker service fails to start](#docker-service-fails-to-start)

#### Quanta Technical Docs

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

# Docker Install

*Warning: As of 5/28/2024, when I started using Ubuntu 24.04, the docker install process has changed, and I have not yet updated the below info to represent the new required changes. The below process may have only slightly changed, however. One breaking change was that you'll need to be using 'docker compose' rather than 'docker-compose'*

## How to Install Docker Compose

There's nothing in this file specific to Quanta. This information is just purely about how to install Docker and Docker Compose, and would be the same for any Ubuntu 22.04 instance. This file is provided just as a quick reference.

## Prerequisite

    sudo apt update
    sudo apt upgrade
    sudo apt install curl

## Installing Docker

Great instructions can be found here:

https://www.digitalocean.com/community/tutorials/how-to-install-and-use-docker-on-ubuntu-22-04

Here are the commands in case digitalocean.com is ever not available:

    sudo apt install apt-transport-https ca-certificates curl software-properties-common

    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    sudo apt update

    apt-cache policy docker-ce

    sudo apt install docker-ce

    sudo systemctl status docker

## Allow Docker Command without Sudo

Note: leave ${USER} in the command below. run verbatim as shown below:

Run when logged in as 'clay'

    sudo usermod -aG docker ${USER}
    su - ${USER}

Check that it worked:

    groups

## Installing Docker Compose

Go here to find latest release version:
https://github.com/docker/compose/releases

And take the version number that's the latest and embed it into the command below and run...

    sudo curl -L "https://github.com/docker/compose/releases/download/v2.22.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

    sudo chmod +x /usr/local/bin/docker-compose

check the version

    docker-compose -v

## Put Docker in Swarm Mode

All you need to do is run this command:
 
    sudo docker swarm init
    
If you get an error like the following... 

Error response from daemon: could not choose an IP address to advertise since this system has multiple addresses on different interfaces (192.168.1.8 on wlp0s20f3 and 192.168.1.3 on enx3448edafc667) - specify one with --advertise-addr

...that means you have an Ethernet (enx...) and a wifi (wlp...) connection, so choose probably the ethernet. and run a command like this, to get the warm initialized.

    sudo docker swarm init --advertise-addr 192.168.1.3

# How to Build

## Front-End Notes

### About Yarn

To manually install packages:

In `src/main/resources/public` run `yarn install`

Run `yarn outdated` to see which package versions are outdated and can be upgraded.

To update a specific package to latest version:

```
yarn upgrade [package-name] --latest
```

* Deployment is build using `vite`

* The project uses `yarn` as the package manager, rather than `npm`.

* It's recommended that you use `nvm` as your way of installing, and managing node versions.

## How to Build Quanta - Dev Mode

To build and start an instance of Quanta on localhost for deveopment use `/scripts/build-dev.sh` which is configured by the settings in `setenv-dev.sh`

## Front-end Hot Deploy

If you have the server running and you then edit only TypeScript files, or other front-end files, and want to test those changes you can run just `build-vite.sh` to make those changes go live in the running server.

## Back-end Hot Deploy

Likewise, if you have the server running and you then edit only Java files, and want to test those changes you can run just `build-dev-java.sh` to make those changes go live in the server running server.

## Production Builds

If you've already understood `build-dev.sh` and how it works you'll notice `build-distro.sh` (used for doing production builds) is very similar.

This script creates the distro folder in `[project]/distro` and updates the local docker repository with the current file image for the QUANTA_VER that's set. Once the docker image is in the docker repo the app can then be run by using the script in the distro folder.

# How to Run

## How to Run the Quanta Server

Quanta uses Docker Compose to run. Here are the steps to run an instance of the Quanta server.

## Step 1 - Install Docker

Install Docker and Docker Compose. You can do that the way you normally do, or if you're not sure how you can refer to the detailed steps in `docker-install.md` file in this folder.

## Step 2 - Docker Swarm Mode

You need to have docker running in 'swarm mode'. Again refer to `docker-install.md` file for complete instructions if you're not sure how to activate swarm mode.

## Step 3 - Make Runtime Folder

Prepare a folder from which you will run the app, which contains all the configuration files, etc. The entire `distro` folder in the root of the project is exactly for this purpose. You should copy that entire folder (including all files and subfolders) to whever you want to run Quanta from. The files in this `distro` folder should work 'as is' to create a minimal functional installation, but of course you can modify any of the config files contained in this folder to setup your real passwords, database folders, etc.

Note that this `distro` folder doesn't contain the actual compiled binaries but will get those form docker repository when you run the app.

## Step 4 - Start and Stop the app

To run a Quanta instance from the Docker Public Repository you can just run `run-distro.sh` from the 'distro' folder. To stop the app run `stop-distro.sh`.

## Note 1

You should edit the passwords in the `setenv-run-distro.sh` file before your first run, because it initializes the MongoDB database and the admin user account with those passwords during the first run.

## Note 2

You'll see in the setenv file that the data folder for MongoDB defaults to `${DEPLOY_TARGET}/data` unless you change it, and when you run the app for the first time that folder must exist, but can be empty. If empty a new database will be created there. Any time you want to wipe the database and start over you can simply delete the files in this data folder (with the server offline) and then restart the server.

# PostgreSQL

## PostgreSQL Notes

Postgres is used to hold a transactions table which keeps track of financial expendatures for all users. The only kinds of expendatures currently are the OpenAI API charges, for access to ChatGPT

## Postgre Docker Compose

See the docker compose yaml files for configuration details. Our Postgre instance, like every other component of Quanta is using docker.

## Postgre Admin

In the docker compose yaml file, there is a section (currently commented out) which can run pgAdmin4 right from inside the docker instance, but it's commented because there's currently no justification for consuming expensive server-side resources for managing the database when we can manage it remotely instead.

The way we do this is by running a separate dockerized pgAdmin4 instance from some other machine like this:

```sh
docker pull dpage/pgadmin4
docker run -p 5051:80 \
    -e 'PGADMIN_DEFAULT_EMAIL=user@none.com' \
    -e 'PGADMIN_DEFAULT_PASSWORD=password' \
    -d dpage/pgadmin4
```

Makes server avilable at http://127.0.0.1:5051

Or by running an instance of pgAdmin from inside a docker compose file locally as is done in `dc-dev.yaml`, which is the development config.

Assuming we're using the config in `dc-dev.yaml', once you login to the admin console at `http://127.0.0.1:5051`, here are the connection settings that can get you connected DB instance of the Quanta app and it's Postgres instance, and in the case below it's the dev db:

```txt
Connection Host: pgdb-host-dev
Port: 5432 <--- note this is the internal port not the one in our env var
Maintenance Database: postgres
User: quanta-pg
Password: see: ${pgPassword}
```

# AI Notes

## About AI Cloud Services HTTP Calls

Currently we use direct HTTP calls to the various AI Cloud providers that we support rather than going thru a Java wrapper library. The reason for this because this app was written before there were any good Java AI libraries. As of the time of this writing (6/26/24) there are actually two choices that we could use which are 1) Spring AI and 2) LangChain4J. However the Spring AI is still in early development so it's not a viable choice. I'd prefer to use Spring rather than any other non-Spring library too. So I will wait several more months, or up to a year to see which one (Spring AI vs LangChain4J) ends up being the best choice, and my hunch is that I'll likely opt for Spring.

# Troubleshooting

If something doesn't work, here's some tips to troubleshoot docker and the app. These are just some random notes and commands that might come in handy during troubleshooting something going wrong the app or anything related to docker

## Healthcheck Results

    docker inspect --format "{{json .State.Health }}" <container-name>

## Realtime Monitoring Console 

Monitoring CPU & Memory

    docker stats

## Check to see what Docker has Running

    docker ps
    docker network ls
    docker service ls

Should show something like these two: 'subnode/repo:quanta1.0.26' and 'mongo:4.0'

## Check Docker Images

https://docs.docker.com/engine/reference/commandline/image_ls/

    docker image ls --digests | grep "quanta"
    docker image ls --digests | grep "mongo"

## Inspect your Docker Repository

    docker image inspect subnode/repo:quanta1.0.26

The "RepoDigests" in the output should contain the same digest shown in the "hub.docker.com" website.

## Check Docker Logs

    docker logs <container-name>
    docker service logs <service-name>

    If container can't even start run `docker ps -a` to get it's container ID, and then run
    docker logs <container_id>

## Delete all Images

https://codenotary.com/blog/extremely-useful-docker-commands

First stop everything:

    docker stack ls

    docker stack rm quanta-stack-local
    docker stack rm quanta-stack-dev

Stop all images

    docker stop $(docker ps -a -q) 

Just as an extra check do a prune first:

    docker system prune -a
    docker image prune -a

Removes all images

    docker rmi -f $(docker images -aq)

Print all images (should be empty now)

    docker images

Stop docker just to force it to reload and know NO images exist
(just a paranoia step
)
    sudo systemctl stop docker

Bring it back up

    sudo systemctl start docker

    
## Try to Pull again. 

Should tell you image is already up to date

    docker image pull subnode/repo:quanta1.0.26

## To Remove Most Running things

    docker kill $(docker ps -q)

    docker stack ls
    docker stack rm ${stack_name}

    docker service ls
    docker service rm ${serice_name}

    docker network ls
    docker network prune

## To Cleanup Disk Space

    docker system prune -a
    docker image prune -a

## Docker service fails to start

Here are some troubleshooting tips from ChatGPT, for the situation where one of the services of the swarm fails to start and `docker ps -a` also doesn't even show the service. The answer below was given to me during troubleshooting why `quanta-stack-distro_quanta-distro` was failing to start, and it ended up being an issue with Certbot configuration in my case, but the troubleshooting below will be helpful for many different scenarios.

When dealing with a Docker service in a Swarm that isn't starting, and where logs aren't showing up, it can be particularly challenging to diagnose the issue. Given that you hinted it might be network-related, especially after recent changes involving certificates and possibly network settings, here are some steps you can follow to troubleshoot the issue:

### 1. Check Service Status
First, ensure the service is actually recognized and attempted to be started by Docker Swarm:

```bash
docker service ls
```

Look for the service `quanta-stack-distro_quanta-distro` and check its REPLICAS column. If the numbers are `0/1` or similar, it means the service is recognized but no instances are running.

### 2. Inspect Service
Inspect the service to see if there are any configurations that might be causing issues:

```bash
docker service inspect quanta-stack-distro_quanta-distro
```

Pay attention to the "Networks" section to see if it's correctly configured. Also, look at the "TaskSpec" to ensure all parameters such as environment variables, mounts, etc., are correctly set.

### 3. Check Service Tasks
Since `docker service logs` didn't show anything, check the tasks for the service to see their state:

```bash
docker service ps quanta-stack-distro_quanta-distro --no-trunc
```

This command shows the tasks and their current state. If tasks are in a "Pending" or "Rejected" state, it can give you clues as to why the service isn't starting.

### 4. Network Troubleshooting
Since the issue may be network-related:

### a. Network Inspect
Inspect the network to which the service is connected:

```bash
docker network inspect [network_name]
```

Check for any anomalies or misconfigurations, especially related to subnets, gateways, or attached services.

### b. Check Connectivity
If possible, try pinging or connecting to relevant network resources or services manually from within another container on the same network.

### 5. Check System Resources
Sometimes, services fail to start because of insufficient system resources (CPU, memory, disk space):

```bash
df -h
free -m
```

### 6. Docker Daemon and System Logs
Since `docker service logs` isn't showing anything, consider looking at the Docker daemon logs or system logs:

```bash
### For Docker daemon logs (the exact command can vary by system)
journalctl -u docker.service

### General system logs
dmesg
```

### 7. Configuration Issues
Review any recent changes to Docker Compose files or Dockerfile. Ensure that environment variables, especially those related to networks or certificates, are correct.

### 8. Restart Docker Swarm Services
Sometimes, a simple restart can help if there are transient issues:

```bash
docker service scale quanta-stack-distro_quanta-distro=0
docker service scale quanta-stack-distro_quanta-distro=1
```

### 9. Check Certificates and Ports
Ensure that no other service is using the ports assigned to your service and check that the certificates are correctly mounted and valid.

### Conclusion
If after all these steps the issue remains unresolved, consider isolating the component outside of Docker Swarm (e.g., in a standalone Docker container) to see if it starts successfully. This can help determine if the issue is with the application itself or the Swarm configuration.
