# Building the App

## Build Basics

You should have a working knowledge of the following things before you try to build Quanta (at least if you want to understand it): 

Maven, Docker, Docker Compose, Linux Bash Scripts, Java, TypeScript, WebPack, MongoDB

# Build Scripts

The bash shell scripts for building the code are named 'build--*.sh' in the project root. There are 4 of them for various kinds of deployments. Each one has notes in the top saying what it's for.

# About the Builder

This app uses maven as the builder (see pom.xml), and the languages involved are Java and TypeScript. The build generates a 'fat jar' containing Tomcat and the WebApp itself, and is a free-standing Java JAR that contains everything, all the code. This fat jar is turned into a docker image, for deploying in a 'docker compose' container.

The way MongoDB is integrated into the runtime is by having a docker instance that contains both the MongoDB and the App fat JAR deployed.

# Prerequisites

If you're running Linux the following will need to be installed before running a build:

## Install Java

You should use only Java11 or later.
 
https://www.linode.com/docs/development/java/install-java-on-ubuntu-18-04/

https://www.digitalocean.com/community/tutorials/how-to-install-java-with-apt-on-ubuntu-20-04

## Install Maven

```
sudo apt update
sudo apt install maven
mvn -version
```

Maven Note: If you use the build scripts (i.e. build-dev.sh, build-prod.sh, build-test.sh), beware those *generate* the 'pom.xml', so if you edit pom.xml directly your changes will be overwritten. So instead, edit pom-main.xml and also the files in the 'pom-fragements' folder.

Why are we *generating* the pom.xml? Basically the reason is to make it where we can include dependencies from external files like this:

```
    <dependencies>
        <!--include:org.springframework.boot.xml-->
        <!--include:common.xml-->
    </dependencies>
```
I realize you can setup 'parent poms' and change the entire structuring of the pom architecure, but in my opinion it's nonsensical to jump thru those kinds of hoops and complexities just to overcome the lack of an 'include' statement in the POM file language. Since implementing this 'include' feature on my own took only 5 lines of Linux Bash script, that's what I did. The tradeoff is a tiny bit of added complexity, for a decent amount of added convenience.

## Install Docker

Instructions for how to install docker are in ./docker-install.md

## Install NodeJS + NPM

https://www.npmjs.com/package/webpack-dev-server

```
sudo apt update
sudo apt install nodejs
sudo apt install npm
npm install webpack-dev-server --save-dev
```

IMPORTANT!!!
You need to check the 'nodeVersion' in the 'pom-main.xml' file and make sure it matches what's on your system, meaning the same thing you get when you run 'node --version' because if you don't things will not work.

## Install Node SASS (SCSS support)

This app uses a very simple (command line) way of integrating SCSS support into the build by letting maven call the bash script named 'src/main/resources/public/on-build-start.sh' during the build, and all that script does is convert SCSS files to CSS files, so before running a build you will therefore need to manually make sure node-sass is installed using the following command:

```
sudo npm install --save-dev --unsafe-perm -g node-sass
```

## Getting NPM in order

To ensure everything with npm is ok, delete the 'node_modules' folders completely.

Then run 'npm install' from the folder that contains he 'package.json' file. 

## Upgrading NPM Versions (optional)

From folder with package.json run 'npm outdated' to see what packages are outdated.

Run 'npm update' to get to the newest 'sub-releases' which is new packages but not new MAJOR versions.

## Install VSCode (Optional)

All the info above, in this file, is a requirement to build and run the app, but VSCode is just a personal recommendation, especially because this app uses TypeScript for all client-side code. 

From here:
https://code.visualstudio.com/

Then install the Java Debugger and Java development plugins into it from Redhat and Microsoft. 

If you do use VSCode you will be able to use the file */.vscode/tasks.json* to run build scripts.

# Maven 'dev' Profile

How to do a kind of "Hot Deploy" of client-side files, without requiring a full build:

When you set "MAVEN_PROFILE=dev" in the script it will automatically re-launch the docker image, when it runs. So if you are changing back-end code (meaning Java), you can run with the dev profile and it will rebuild and deploy. 

However if you have the app deployed already and have only just edited client side files (i.e. TS or SCSS namely) then the webpack profile (i.e.: mvn generate-resources -DskipTests -Pwebpack) is all you need to run,(to see the changes after a browser refresh) which builds MUCH faster and without restarting the app. NOTE: To be able to make that 'webpack' profile work, the other thing you're doing to need to do is to into dev-docker-run.sh and search for dev-resource-base (in two places) and understand that what's going on there is that it's making the webapp look into that folder "live" at runtime (instead of the build/deployed JAR in the docker image), which is how it enables the app to load those files without doing a full rebuild. This is similar to a 'hot deploy' type thing, but the WebApp is actually making the decision to read from there at runtime, when that property is set.

# Rapid Redeploy of Java Classes

The `dev` maven profile (see build-dev.sh) also is configured to deploy to docker in a way where the classpath is overridden to load classes directly from the `${PRJROOT}/target/classes` at runtime. For a full description of how this works, or how to stop doing that, see ./how-to-redeploy-java-classes.md

# Configure secrets.sh and ENV vars before you Build!

In file `setenv-common.sh` you'll see a `secrets.sh` file. You must provide this file yourself and all it should be is a shell script with the following exports defined.

    #!/bin/bash
    export emailPassword=
    export devEmail=
    export testPassword=
    export subnodePassword=
    export prodKeyStorePassword=
    export reCaptcha3SiteKey=
    export reCaptcha3SecretKey=

Also you'll need to edit any of the `setenv-*.sh` scripts to put in your own paths before you run a build. There are only a couple of paths that you'll need to provide, but they are critical/required. The builder won't run without them set correctly. 

# ESLint Notes

## Installing command line linter:

https://www.npmjs.com/package/eslint

* To install: 

    npm install eslint --save-dev

* Run interactive setup utility:

    ./node_modules/.bin/eslint --init

* Run in folder with packages.json (root)

    ./node_modules/.bin/eslint ./ts/**/*.ts

## Install VSCode Plugins

ESLint (by Dirk Baeumer)

Prettier ESLint (by Rebecca Vest
)