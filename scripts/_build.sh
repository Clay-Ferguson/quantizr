#!/bin/bash
# DO NOT call this script directly. It's called from other scripts.

# show commands as they are run.
# set -x

if [ -z "$quanta_domain" ]
then
    read -p "\$quanta_domain is empty. Don't run this batch file directly. It's run from a 'build--*.sh' file"
    exit
fi

echo "Running _build.sh for $quanta_domain"

# Wipe some existing stuff to ensure it gets rebuilt
if [ "$CLEAN" == "true" ]; then
    rm -rf ${PRJROOT}/target/*
    rm -rf ${PRJROOT}/bin/*
fi

rm -rf ${PRJROOT}/src/main/resources/public/bundle.js

# Run ignore-scripts for some security from NodeJS
# Packages can run "postinstall" script from their package.json and that is an attack vector we want to eliminate here.
cd ${PRJROOT}/src/main/resources/public
npm config set ignore-scripts true

cd ${PRJROOT}
${SCRIPTS}/run-linter.sh

# Generate 'pom.xml' dynamically from file parts
cd ${PRJROOT}/pom-fragments
./pom-generate.sh

cd ${PRJROOT}
# These aren't normally needed, so I'll just keep commented out most of time. 
# mvn dependency:sources
# mvn dependency:resolve -Dclassifier=javadoc
# mvn dependency:tree clean exec:exec package -DskipTests=true -Dverbose

# This build command creates the SpringBoot fat jar in the /target/ folder.
# Note: If CLEAN is false we're going for the fastest possible build.
if [ "$CLEAN" == "true" ]; then
    # This run is required only to ensure TypeScript generated files are up to date.
    # Always do the same profile here (pdev-vscode)
    mvn package -DskipTests=true -Pdev-vscode

    # Then this is the actual full build.
    mvn clean package -DskipTests=true -P${mvn_profile}
else
    mvn --offline package -DskipTests=true -P${mvn_profile} 
fi
verifySuccess "Maven Build"
