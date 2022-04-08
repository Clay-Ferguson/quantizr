# How to: Build and/or Run Quanta

### Overview

The easiest way to get started running Quanta is to run the Public Docker Repo image, without building the executables yourself. This file will explain how to do that as well as how to build the executable yourself. Regardless of whether you run from the public repository image, or an image you build yourself, you'll need a runtime folder that holds all the configuration files for the installation. Such a runtime folder can be easily created by unzipping the "Distro Zip" which contains all that stuff pre-configured with usable defaults.

### Run from Public Docker Image

To run a Quanta instance from the Docker Public Repository you can simply unzip the Distro Zip file (named like `./distro/quanta-1.0.24.tar.gz` in the github project files) onto a linux folder, and then start the app with `run-distro.sh`. This will create a minimal installation running at `http://localhost:8185`. To stop the app run `stop-distro.sh`. The only prerequisite for this is `docker` and `docker-compose`.

NOTE: You should edit the password in `secrets.sh`, before your first run, because that password will become your `admin` user password which you can use to login as the `admin` user, and will also be the password securing your MongoDB instance.

So to reiterate, this Distro Zip contains everything needed to configure the app, and by default it will have the effect of using the Public Docker image as the executable to run.

### Run from Locally-built Executable 

If you want to run Quanta executable code you've built yourself, you'll still use a Distro Zip to create a configuration location and files (by just unzipping the Distro Zip into some folder), but after unzipping this Distro Zip you'll drop in the actual SpringBoot fat-jar file (that you built) onto the Distro Zip directory before running `run-distro.sh`. The scripts in the distro location will automatically detect that the SpringBoot file exists (by looking for the `${JAR_FILE}` file), and if that JAR file (executable) is found the script will automatically do a docier build that installs and runs from this local JAR file instead of a Public Docker Repository file.

So to summarize, your Distro Zip files will automatically use the JAR file if it's found, or default to the Public Docker Repo only if no JAR is found.

### Building the Distro Zip (and executable JAR)

If the above made sense so far, you'll know there's a zip file (the Distro Zip) which contains a confuration for the installation files, and also a SpringBoot fat JAR that can be built too. Bboth of those things (Distro Zip file, and Fat JAR file) can themselves be built from scratch using `./scripts/build-distro.sh`, which will build them both. After you run the `build-distro.sh` you'll find the Fat JAR in the `./target/` folder and the Distro Zip file in the `./distro` folder. Then to repeat again for clarity, you can simply unzip the Distro Zip file into some empty folder, then drop the Fat JAR into that folder, and then run script `run-distro.sh` to get a server up and running.

### How to Develop Quanta

This section gives the recommended way for working on Quanta. That is, how to edit code, rebuild, and then test your changes, as rapidly as possible. Basically this involves doing something very similar to the above process to first create some folder on your computer (separate and away from the GitHub source folder) where you will create the Distro files, and be able to run from there. Then you will adapt and use the files named `build-dev.sh` (which you won't necessarily edit) and `setenv-dev.sh` (which you will definitely edit). Both `build-dev.sh` and `setenv-dev.sh` are complete and do work, but you'll want to put into the setenv file your own port numbers, folder locations, etc. Most of the varible names are all the same in any 'setenv*.sh' files and there's the same set of variables for both a prod deploy and a dev setup. If you open `setenv-dev.sh` you'll see that each variable setting has a short description telling you what needs to go there.

Once you have `setenv-dev.sh` all configured you should be able to run `build-dev.sh` which will build the code from scratch and start an instance of Quanta, that you can test against. If you then edit only TypeScript files and want to test those changes you can run just `build-webpack.sh` to make those changes go live. Or if you edit only Java files you can run `restart-dev.sh` to see those changes go live, and immediately test them.



