#!/bin/bash

# These are the commands I used to install 'Docker CE' on Ubuntu 18.04, which I only include as a helpful
# file so help developers know how to get docker up and running, in case you aren't already using docker, but there is
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

read -p "All done."
