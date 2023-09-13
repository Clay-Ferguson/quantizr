# How to Run/Build Quanta

## Overview

The easiest way to run Quanta is to run the Public Docker Repo image, without building the executables yourself. This file will explain how to do that as well as how to build the executable yourself, using Linux shell scripts. Regardless of whether you run from the Docker public repository image, or a docker image you build yourself, you'll need a runtime folder that holds all the configuration files for the installation. A fully complete example runtime folder is provided in the github repository project under the '/distro' folder.
## Option #1: Run from Public Docker Image

To run a Quanta instance from the Docker Public Repository you can just run `run-distro.sh` from the 'distro' folder. This 'distro' folder is completely self-contained, and can be copied to a production machine or anywhere else to serve as your Quanta installation folder. To stop the app run `stop-distro.sh`. 

The only prerequisite for this is that you have `docker` and `docker-compose` installed, and you need to setup docker to have 'swarm' capability using this command: `docker swarm init`

NOTE: You should edit the password in the `setenv-*.sh` file before your first run, because that password will become your `admin` user password which you can use to login as the `admin` user in the app, and also will be the password securing your MongoDB instance. Also before you run the app you should probably at least look in the `setenv-*.sh` file, to see what other configs are in there, and perhaps the docker-compose YAML file too, but they should all contain usable defaults right out of the box.

## How to Develop Quanta

To build and start an instance of Quanta on localhost for deveopment use `/scripts/build-dev.sh` which is configured by the settings in `setenv-dev.sh` Notice there's a QUANTA_BASE environment var where you should specifiy some folder you want to run your deployment from, and everything gets copied into there.
 

If you then edit only TypeScript files and want to test those changes you can run just `build-vite.sh` to make those changes go live. Or if you edit only Java files you can run `restart-dev.sh` to see those changes go live, and immediately test them. 

## Production Builds

If you've already understood `build-dev.sh` and how it works you'll notice `build-distro.sh` (used for doing production builds) is very similar.
