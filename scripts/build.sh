#!/bin/bash -i

# show commands as they are run.
# set -x

if [ -z "$quanta_domain" ]
then
    read -p "\$quanta_domain is empty. Don't run this batch file directly. It's run from a 'build-*.sh' file"
    exit
fi

echo "Running build.sh for $quanta_domain"

yarnCheck "Before main build"
rm -rf ${PRJROOT}/target/*
rm -rf ${PRJROOT}/bin/*

# copy the marked js file into location where export engine finds it
# The latest marked version that I need for support in static html files is missing
# the typescript type file, so I'm leving my NPM at an older version and putting
# the latest version manually into 'export-includes'
# cp ${PRJROOT}/src/main/resources/public/node_modules/marked/marked.min.js \
#    ${PRJROOT}/src/main/resources/public/export-includes/marked.min.js

cd ${PRJROOT}

# build with apidocs
# mvn install

# build without apidocs
echo "mvn install the pom-common.xml into repo"

# WARNING: DO NOT DELETE: After you upgrade to a new version of Java, you MUST run this command with "clean" in it!
# mvn -T 1C clean install -Dmaven.javadoc.skip=true
mvn -f pom-common.xml -T 1C install -Dmaven.javadoc.skip=true
yarnCheck "After mvn run"
verifySuccess "Maven install common pom"

# These aren't normally needed, so I'll just keep commented out most of time. Tip: Only run any of these AFTER
# you've successfully run a build, and if you changed a bunch of stuff delete ".m2" folder on your machine first!
# mvn dependency:sources clean
# mvn dependency:resolve -Dclassifier=javadoc
# mvn dependency:tree clean exec:exec package -DskipTests=true -Dverbose

# This build command creates the SpringBoot fat jar in the /target/ folder.
echo "Maven package ${mvn_profile}"
# This run is required only to ensure TypeScript generated files are up to date.
# Always do the same profile here (dev-vscode)
mvn -f pom.xml -T 1C package -DskipTests=true -Pdev-vscode
verifySuccess "Maven install commmon dev-vscode (typescript gen)"
yarnCheck "After mvn packaging"

cd ${PRJROOT}/src/main/resources/public
. ./build.sh

cd ${PRJROOT}

# for deprecated stuff
# mvn -T 1C clean package -DskipTests=true -Dmaven.compiler.showDeprecation=true -P${mvn_profile}

# Then this is the actual maven full build of the server springboot app
mvn -f pom.xml -T 1C clean package -DskipTests=true -P${mvn_profile}
verifySuccess "Maven Build"
yarnCheck "Before main full build"
