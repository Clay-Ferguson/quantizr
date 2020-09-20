# Updated for Ubuntu 20.04 as of July 2020.

https://askubuntu.com/questions/1230189/how-to-install-docker-community-on-ubuntu-20-04-lts

# Official Docker Docs for Installing (I'm not doing this, see below)

https://docs.docker.com/engine/install/ubuntu/

# Ubuntu App Store way to Install (do this!)

    sudo apt install docker.io
    docker --version

# Install Docker Compose

https://www.techiediaries.com/ubuntu/install-docker-19-docker-compose-ubuntu-20-04/

    sudo apt install docker-compose
    docker-compose --version

The rest of these commands need to run and are the same as the old steps below.

    sudo systemctl enable docker
    sudo service docker status

# I ran this to troubleshoot a problem but i am not sure if it's necessary:
# apt-get install haveged -y

# Ran this to init a local registry

    sudo docker run -d -p 5000:5000 --restart=always --name registry registry:2

# Allow running docker without 'sudo' (two commands below):

https://docs.docker.com/install/linux/linux-postinstall/

    sudo groupadd docker
    sudo usermod -aG docker $USER

Note: do logout/login in linux after running these two lines above.

# Docker Tips

## NOTE

After the cleanup below we *might* (i'm not sure) need to run this again:

    sudo docker run -d -p 5000:5000 --restart=always --name registry registry:2

## To cleanup:

(doesn't seem to remove EVERYTHING)

    docker system prune

## To remove all containers,

    # switch to root.
    su -

    docker rm -vf $(docker ps -a -q)

-v: Remove all associated volumes

-f: Forces the removal. Like, if any containers is running, you need -f to remove them.

## To remove all images,

    # switch to root.
    su -

    docker rmi -f $(docker images -a -q)

-a: for all containers, even not running, (or images)

-q: to remove all the details other than the ID of containers (or images)    


# ========================================================
# All of the below was early to mid 2019 for Ubuntu 18.04
# all the below is obsolet as of Ubuntu 20.04
# ========================================================

# These are the commands I used to install 'Docker CE' on Ubuntu 18.04, which I only include as a helpful
# file for any developers who aren't familiar, but there is
# nothing in the maven build (pom.xml) that requires docker, and the docker part is completely optional. You can simply
# run build-prod.sh and omit the docker part if you want.
  
# sudo apt-get remove docker docker-engine docker.io containerd runc

# sudo apt-get update

# sudo apt-get install apt-transport-https ca-certificates curl software-properties-common

# curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -

# NOTE: on 18.04 the $(lsb_release -cs) evaluates to 'bionic'
# sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"

# sudo apt-get update

# sudo apt-get install docker-ce

# sudo docker container run hello-world

# sudo systemctl enable docker

# sudo service docker status

# I ran this to troubleshoot a problem but i am not sure if it's necessary:
# apt-get install haveged -y

# Ran this to init a local registry
# sudo docker run -d -p 5000:5000 --restart=always --name registry registry:2

# follow these steps to be able to run docker without 'sudo' (two commands below):
# https://docs.docker.com/install/linux/linux-postinstall/
# Note: do logout/login in linux after running these two lines;
# sudo groupadd docker
# sudo usermod -aG docker $USER

# Installing Docker Compose
# sudo curl -L "https://github.com/docker/compose/releases/download/1.25.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
# sudo chmod +x /usr/local/bin/docker-compose
