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

export ipfs_data=/home/clay/.ipfs
export ipfs_staging=/home/clay/.ipfs/staging

export quanta_domain=localhost

# IMPORTANT: ***** You must set this to 'true' to regenerate the Java->TypeScript interfaces.
export CLEAN=true

# Docker files are relative to project root
export docker_compose_yaml=docker-compose-dev.yaml
export docker_compose_mongo_yaml=docker-compose-dev-mongo.yaml
export mvn_profile=dev

export MONGO_BASE=/home/clay/ferguson
export QUANTA_BASE=/home/clay/quanta-localhost-dev

