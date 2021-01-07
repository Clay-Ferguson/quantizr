#!/bin/bash
# todo-0: fix paths

if [ -f ./vscode-cwd.sh ]; then
  source ./vscode-cwd.sh
fi

clear
source ./setenv.sh
source ./define-functions.sh

# NOTE: this was an experiment to run webpack-dev-server. Ended up not wanting it.

# http://localhost:8081/dist/index.html

# This works as expected for loading static resources, but for now we are just setting the
# resourcesBaseFolder app property, so that a docker shared folder can read from that location
# and so the actual webpack-dev-server is not needed, and we use the following in tasks.json, to 
# compile the TS to JS and allow reloading of static resources from that resourcesBaseFolder location.
    # {
    #         "label": "BUILD - WebPack Only",
    #         "type": "shell",
    #         "command": "mvn generate-resources -DskipTests -Pwebpack",
    #         "group": "build",
    #         "problemMatcher": []
    # },
# 

# cd $PRJROOT/src/main/resources/public
# node_modules/.bin/webpack-dev-server

