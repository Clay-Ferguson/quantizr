**[Quanta](/docs/index.md) / [Quanta-Technical-Docs](/docs/dev-guide/index.md)**

* [Docker Install](#docker-install)
    * [How to Install Docker Compose](#how-to-install-docker-compose)
    * [Prerequisite](#prerequisite)
    * [Installing Docker](#installing-docker)
    * [Allow Docker Command without Sudo](#allow-docker-command-without-sudo)
    * [Installing Docker Compose](#installing-docker-compose)
    * [Put Docker in Swarm Mode](#put-docker-in-swarm-mode)

# Docker Install

*Warning: As of 5/28/2024, when I started using Ubuntu 24.04, the docker install process has changed, and I have not yet updated the below info to represent the new required changes. The below process may have only slightly changed, however. One breaking change was that you'll need to be using 'docker compose' rather than 'docker-compose'*

# How to Install Docker Compose

There's nothing in this file specific to Quanta. This information is just purely about how to install Docker and Docker Compose, and would be the same for any Ubuntu 22.04 instance. This file is provided just as a quick reference.

# Prerequisite

    sudo apt update
    sudo apt upgrade
    sudo apt install curl

# Installing Docker

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

# Allow Docker Command without Sudo

Note: leave ${USER} in the command below. run verbatim as shown below:

Run when logged in as 'clay'

    sudo usermod -aG docker ${USER}
    su - ${USER}

Check that it worked:

    groups

# Installing Docker Compose

Go here to find latest release version:
https://github.com/docker/compose/releases

And take the version number that's the latest and embed it into the command below and run...

    sudo curl -L "https://github.com/docker/compose/releases/download/v2.22.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

    sudo chmod +x /usr/local/bin/docker-compose

check the version

    docker-compose -v

# Put Docker in Swarm Mode

All you need to do is run this command:
 
    sudo docker swarm init
    
If you get an error like the following... 

Error response from daemon: could not choose an IP address to advertise since this system has multiple addresses on different interfaces (192.168.1.8 on wlp0s20f3 and 192.168.1.3 on enx3448edafc667) - specify one with --advertise-addr

...that means you have an Ethernet (enx...) and a wifi (wlp...) connection, so choose probably the ethernet. and run a command like this, to get the warm initialized.

    sudo docker swarm init --advertise-addr 192.168.1.3


----
**[Next: How-to-Build](/docs/dev-guide/how-to-build.md)**
