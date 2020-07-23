# Building the App

This app uses maven as the builder (see pom.xml), and the languages involved are Java and TypeScript. The build generates a 'fat jar' containing Tomcat and the WebApp itself, and is a free-standing Java JAR that contains everything needed at runtime except for the MongoDB database. The way MongoDB is normally integrated into the runtime is by having a docker instance that contains both the MongoDB and the App fat JAR deployed.

There are two build scripts in the root of the project: build-dev.sh, and build-test.sh. The 'build-dev.sh' is for running locally during development and will startup a debuggable instance of the docker containers when run. The build-test.sh builds and saves the docker containers into a TAR file for deploying into a test environment.

# Prerequisites

If you are running Linux (18.04 as of 4/5/2019, when this is being written) here are the things to run before building and also I'm including the actual commands to install all these things:

Linode Config: 4GB RAM, 2CPU, 80GB Storage

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

Docker install commands are all inside docker-install.sh (in this same folder), so you would need to just uncomment all the non-comments (i.e. all commands you see in that entire file), and then run them all in the order they appear in that file, to install docker. That script is not 'guaranteed' to work but should be complete however, and serves as a good hint at how to get things installed.

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

IMPORTANT!!!
You need to check the 'nodeVersion' in the 'pom-main.xml' file and make sure it matches that's on your system, meaning the same
thing you get when you run 'node --version' because if you don't things will not work, when various versions on things are outta wack.

## Install Node SASS (SCSS support)

This app uses a very simple (command line) way of integrating SCSS support into the build by letting maven call the bash script named 'src/main/resources/public/on-build-start.sh' during the build, and all that script does is convert SCSS files to CSS files, so before running a build you will therefore need to manually make sure node-sass is installed using the following command:

```
sudo npm install --save-dev --unsafe-perm -g node-sass
```

## Getting NPM in order

To ensure everything with npm is ok, delete the 'node_modules' folders completely.

Then run 'npm install' from the folder that contains he 'package.json' file. You can manually edit the 'package.json'
before running 'npm install' if you need to update something.

## Upgrading NPM Versions (optional)

From folder with package.json run 'npm outdated' to see what packages are outdated.

Run 'npm update' to get to the newest 'sub-releases' which is new packages but not new MAJOR versions.

## Install VSCode (Optional)

All the info above, in this file, is a genuine requirement to build and run the app, but VSCode is just my personal recommendation, especially because this app uses TypeScript for all client-side code. 

From here:
https://code.visualstudio.com/

Then install the Java Debugger and Java development plugins into it from Redhat and Microsoft. 

If you do use VSCode you will be able to use the file */.vscode/tasks.json* to run build scripts.

# Maven Build

WARNING: Before you run 'build-dev.sh' (or 'build-test.sh') you will need to read and understand the 'setenv.sh' variables and set up your own folders for those. Unfortunately this application is not something you can just download, and build, and run in a matter of a few minutes, because there are several paths that you will need to understand and several moving parts involving the app itself, MongoDB (maybe IPFS if you are enabling that), and how it all is connected and run via Docker setup. The good news is that the *only* paths you need to set are all contained in 'setenv.sh' and each one is docmented as to what it is. However, in general before truing to run a build or run the app, you should open and read every "*.sh" script in the project root. If you don't understand what's going on in those you should probably not even consider building/running the app until you know those things.

# Maven 'dev' Profile

How to do a kind of "Hot Deploy" of client-side files, without requiring a full build:

When you set "MAVEN_PROFILE=dev" in the script it will automatically re-launch the docker image, when it runs. So if you are changing back-end code (meaning Java), you can run with the dev profile and it will rebuild and deploy. 

However if you have the app deployed already and have only just edited client side files (i.e. TS or SCSS namely) then the webpack profile (i.e.: mvn generate-resources -DskipTests -Pwebpack) is all you need to run,(to see the changes after a browser refresh) which builds MUCH faster and without restarting the app. NOTE: To be able to make that 'webpack' profile work, the other thing you're doing to need to do is to into dev-docker-run.sh and search for dev-resource-base (in two places) and understand that what's going on there is that it's making the webapp look into that folder "live" at runtime (instead of the build/deployed JAR in the docker image), which is how it enables the app to load those files without doing a full rebuild. This is similar to a 'hot deploy' type thing, but the WebApp is actually making the decision to read from there at runtime, when that property is set.

# Rapid Redeploy of Java Classes

The `dev` maven profile (see build-dev.sh) also is configured to deploy to docker in a way where the classpath is overridden to load classes directly from the `${PRJROOT}/target/classes` at runtime. For a full description of how this works, or how to stop doing that, see ./how-to-redeploy-java-classes.md

# Before you run 'dev' Profile 

The following maven profile will need to be run in order to update the generated TypeScript. We use this plugin:

    <plugin>
        <groupId>cz.habarta.typescript-generator</groupId>
        <artifactId>typescript-generator-maven-plugin</artifactId>
    ...

...to generate a single TypeScrypt type file named "JavaIntf.d.ts", and this file contains all the interfaces from the Java code so we
don't have to manually create those for TypeScript, but they're generated instead. If you look in build-dev.sh you can see that
builder is doing this also (i.e. running the TypeScript generator maven build right before running the 'real' build.)

    mvn package -DskipTests -Pdev-vscode

