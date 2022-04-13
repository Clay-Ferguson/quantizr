#!/bin/bash

verifySuccess () {
    if [ $? -eq 0 ]; then
        echo "$1 successful."
    else
        echo "$1 failed. EXIT CODE: $?"
        read -p "Press any key to exit."
        exit $?
    fi
}
export -f verifySuccess

dockerCheck () {
    if docker ps | grep $1; then
        echo "$1 started ok"
    else
        read -p "$1 failed to start"
    fi
}
export -f dockerCheck

ipfsConfig () {
    # This sleeping is required to be sure ipfs is started and not 'repo locked'
    echo "Sleeping a few seconds before accessing ipfs"
    sleep 20s

    # todo-1: I'm pretty sure maybe only the API headers need to be set and not Gateway, but haven't confirmed yet
    # (Also there's probably a way to do this inside an actual config text file, rather than on command line)
    docker-compose -f ${dc_app_yaml} exec $1 ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
    docker-compose -f ${dc_app_yaml} exec $1 ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["PUT", "GET", "POST"]'

    docker-compose -f ${dc_app_yaml} exec $1 ipfs config --json Gateway.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
    docker-compose -f ${dc_app_yaml} exec $1 ipfs config --json Gateway.HTTPHeaders.Access-Control-Allow-Methods '["PUT", "GET", "POST"]'

    echo "Sleeping again before restarting ipfs"
    sleep 10s
    docker-compose -f ${dc_app_yaml} restart $1
}
export -f ipfsConfig

dockerBuild () {
    echo "dockerBuild"

    docker-compose -f ${dc_app_yaml} build --no-cache \
        --build-arg PORT="${PORT}" \
        --build-arg PORT_DEBUG="${PORT_DEBUG}" \
        --build-arg PORT_SEC="${PORT_SEC}" \
        --build-arg XMS="${XMS}" \
        --build-arg XMX="${XMX}" \
        --build-arg JAR_FILE="${JAR_FILE}"
        
    verifySuccess "Docker Compose: build"
}
export -f dockerBuild

dockerUp () {
    # I was seeing docker fail to deploy new code EVEN after I'm sure i built new code, and ended up finding
    # this stackoverflow saying how to work around this (i.e. first 'build' then 'up') 
    # https://stackoverflow.com/questions/35231362/dockerfile-and-docker-compose-not-updating-with-new-instructions
    echo "dockerUp"

    if [[ -z ${dc_ipfs_yaml} ]];  
    then  
        echo "ipfs not enabled"
    else
        docker-compose -f ${dc_ipfs_yaml} up -d
        verifySuccess "IPFS Compose: up"
    fi

    if [[ -z ${START_MONGO} ]];  
    then  
        echo "Not starting MongoDB"
    else
        docker-compose -f ${dc_mongo_yaml} up -d
        verifySuccess "MongoDB Compose: up"
    fi

    docker-compose -f ${dc_app_yaml} up -d
    verifySuccess "Docker Compose: up"

    # sleep 10
    # echo "Sleeping 10 seconds before checking logs"
    # docker-compose -f ${dc_app_yaml} logs $1
    # verifySuccess "Docker Compose: logs"
}
export -f dockerUp

# Arg1=yaml file name, Arg2=service
dockerDown () {
    echo "dockerDown $1 serivce $2"

    # NOTE: with remove-orphans it takes down not just what's in our YAML but 
    # also every other docker thing running on the machine!
    # docker-compose -f ${dc_app_yaml} down --remove-orphans
    # docker-compose -f ${dc_app_yaml} stop $2
    #
    # NOTE: If you get errors that your network is still in use do this:
    #     docker network disconnect -f net-distro quanta-distro
    #     docker network disconnect -f net-distro quanta-distro
    docker-compose -f $1 stop -t 30 $2
    docker-compose -f $1 rm -f -s $2
    # docker ps
    # read -p "service $2 should be missing in above"
}
export -f dockerDown


