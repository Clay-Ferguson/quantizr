#!/bin/bash

# Updated for Ubuntu 20.04 as of July 2020.

# IMPORTANT: for Ubuntu 20.04, I had to go into the mongo.conf file and set ownership to allow 'docker' 
#   system user to have provileges to read the file. I was able to determine via 'docker logs mongo-dev' command
# that the failure to remain started after startup was becasue the mongo.conf file was not accessible to the mongo container.

# https://askubuntu.com/questions/1230189/how-to-install-docker-community-on-ubuntu-20-04-lts

# According to this page teh below process is somewhat still available:
#     https://docs.docker.com/engine/install/ubuntu/

# But I'm opting for this new way using Ubuntu repo...

# sudo apt install docker.io
# # to configure to start when reboot
# docker --version

# https://www.techiediaries.com/ubuntu/install-docker-19-docker-compose-ubuntu-20-04/
# sudo apt install docker-compose
# docker-compose --version

# The rest of these commands need to run and are the same as the old 2019 steps below.
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

# IMPORTANT: Remember becasue of Security on MongoDB, you need to look in ~/ferguson/mongo-scripts-dev, and
# remember all that on how to setup security. Until you do so your Quant app won't be able to connect
# because it's expecting security to be in place.

# ALSO: Check the dev build docker compose yaml file, and note where the 'mongo.conf' file is, and whatever you 
# have in there for the security parameter needs to match up with what's in the quanta web app connection (password mainly)

# NOTE:  Troubleshoot by viewing logs with this:
#      docker logs mongo-dev

###############################################################################################################

# ========================================================
# All of the below was early to mid 2019 for Ubuntu 18.04
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

read -p "All done."
