# Building the App

This app uses maven as the builder (see pom.xml), and the languages involved are Java and TypeScript. The build generates a 'fat jar' containing Tomcat and the WebApp itself, and is a free-standing Java JAR that contains everything needed at runtime except for the MongoDB database. The way MongoDB is normally integrated into the runtime is by having a docker instance that contains both the MongoDB and the App fat JAR deployed.

All of the following was verified correct as of 4/5/2019...

There is a build script named 'build.sh' that is in the root of the project, which you can use during development by setting "MAVEN_PROFILE=dev", in it where you see that line in the script, or building a prod version by making the line be "MAVEN_PROFILE=prod" in the script.

# Prerequisites

If you are running Linux (18.04 as of 4/5/2019, when this is being written) here are the things to run before building and also I'm including the actual commands to install all these things:

Linode Config: 4GB RAM, 2CPU, 80GB Storage

## Install Java

You should use only Java11 or later. Trust me on that. :)

So I'm trying this: 
https://www.linode.com/docs/development/java/install-java-on-ubuntu-18-04/


## Check your Ubuntu Version:

```
lsb_release -a
```

## Install Maven

```
sudo apt update
sudo apt install maven
mvn -version
```

## Install Docker

Docker install commands are all inside docker-install.sh (in this same folder). As of 4/5/2019 they are known to be correct, and you would need to just uncomment all the non-comments (i.e. all commands you see in that entire file), and then run them all in the order they appear in that file, to install docker.

```
./docker-install.sh
```

## Install NodeJS + NPM

https://www.npmjs.com/package/webpack-dev-server

```
sudo apt update
sudo apt install nodejs
sudo apt install npm
npm install webpack-dev-server --save-dev
```

## Install Node SASS (SCSS support)

This app uses a very simple (command line) way of integrating SCSS support into the build by letting maven call the bash script named 'src/main/resources/public/on-build-start.sh' during the build, and all that script does is convert SCSS files to CSS files, so before running a build you will therefore need to manually make sure node-sass is installed using the following command:

```
sudo npm install --save-dev --unsafe-perm -g node-sass
```

## Install VSCode (Optional)

All the info above, in this file, is a genuine requirement to build and run the app, but VSCode is just my personal recommendation, especially because this app uses TypeScript for all client-side code. 

From here:
https://code.visualstudio.com/

Then install the Java Debugger and Java development plugins into it from Redhat and Microsoft. 

If you do use VSCode you will be able to use the file */.vscode/tasks.json* to run build scripts.

# Maven Build

WARNING: Before you run the 'build.sh' you will need to read and understand the 'setenv.sh' variables and set up your own folders for those. Unfortunately this application is not something you can just download, and build, and run in a matter of a few minutes, because there are several paths that you will need to understand and several moving parts involving the app itself, MongoDB (maybe IPFS if you are enabling that), and how it all is connected and run via Docker setup. The good news is that the *only* paths you need to set are all contained in 'setenv.sh' and each one is docmented as to what it is. However, in general before truing to run a build or run the app, you should open and read every "*.sh" script in the project root. If you don't understand what's going on in those you should probably not even consider building/running the app until you know those things.

# Maven 'dev' Profile

How to do a kind of "Hot Deploy" of client-side files, without a full build.

When you set "MAVEN_PROFILE=dev" in the script it will automatically re-launch the docker image, when it runs. So if you are changing back-end code (meaning Java), you can run with the dev profile and it will rebuild and deploy. However if you have the app deployed already and have only just edited client side files (i.e. TS or SCSS namely) then the webpack profile (i.e.: mvn generate-resources -DskipTests -Pwebpack) is all you need to run,(to see the changes after a browser refresh) which builds MUCH faster and without restarting the app. NOTE: To be able to make that 'webpack' profile work, the other thing you're doing to need to do is to into dev-docker-run.sh and search for dev-resource-base (in two places) and understand that what's going on there is that it's making the webapp look into that folder "live" at runtime (instead of the build/deployed JAR in the docker image), which is how it enables the app to load those files without doing a full rebuild. This is similar to a 'hot deploy' type thing, but the WebApp is actually making the decision to read from there at runtime, when that property is set.

