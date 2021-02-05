#!/bin/bash

# secrets.sh is required to be a file that contains at a minimum props like the example below, and you can
# put the file anywhere you want as long as you assign SECRETS variable and then 'source' that file
# as done below.
#
# example 'secrets.sh' file content:
#     #!/bin/bash
#     export emailPassword=???
#     export devEmail=???
#     export subnodePassword=???

export SECRETS=/home/clay/ferguson/secrets
source ${SECRETS}/secrets.sh

# Directory that contains the Quanta project (pom.xml is here, for example). 
export PRJROOT=/home/clay/ferguson/Quantizr
export SCRIPTS=${PRJROOT}/scripts

export ipfs_data=/home/clay/ferguson/subnode-run/ipfs
export ipfs_staging=/home/clay/ferguson/subnode-run/ipfs/staging

export quanta_domain=localhost

# IMPORTANT: ***** You must set this to 'true' to regenerate the Java->TypeScript interfaces.
export CLEAN=true

export docker_compose_yaml=docker-compose-test.yaml
export mvn_profile=prod

# deploy target folder is where we will be running the app from
export DEPLOY_TARGET=/home/clay/ferguson/subnode-run