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
    docker-compose -f ${docker_compose_yaml} exec $1 ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
    docker-compose -f ${docker_compose_yaml} exec $1 ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["PUT", "GET", "POST"]'

    docker-compose -f ${docker_compose_yaml} exec $1 ipfs config --json Gateway.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
    docker-compose -f ${docker_compose_yaml} exec $1 ipfs config --json Gateway.HTTPHeaders.Access-Control-Allow-Methods '["PUT", "GET", "POST"]'

    echo "Sleeping again before restarting ipfs"
    sleep 10s
    docker-compose -f ${docker_compose_yaml} restart $1
}
export -f ipfsConfig

dockerBuild () {
    # I was seeing docker fail to deploy new code EVEN after I'm sure i built new code, and ended up finding
    # this stackoverflow saying how to work around this (i.e. first 'build' then 'up') 
    # https://stackoverflow.com/questions/35231362/dockerfile-and-docker-compose-not-updating-with-new-instructions
    echo "dockerBuild"

    docker-compose -f ${docker_compose_yaml} build --no-cache \
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

    docker-compose -f ${docker_compose_mongo_yaml} up -d
    verifySuccess "MongoDB Compose: up"

    # NOTE: --compatibility switch is required for the CPUS limitier to work,
    # in a non-swarm docker setup, which we have
    docker-compose --compatibility -f ${docker_compose_yaml} up -d
    verifySuccess "Docker Compose: up"

    # sleep 10
    # echo "Sleeping 10 seconds before checking logs"
    # docker-compose -f ${docker_compose_yaml} logs $1
    # verifySuccess "Docker Compose: logs"
}
export -f dockerUp

dockerBuildUp () {
    dockerBuild
    dockerUp
}
export -f dockerBuildUp

dockerDown () {
    echo "dockerDown ${docker_compose_yaml} serivce $1"

    # NOTE: with remove-orphans it takes down not just what's in our YAML but 
    # also every other docker thing running on the machine!
    # docker-compose -f ${docker_compose_yaml} down --remove-orphans
    # docker-compose -f ${docker_compose_yaml} stop $1
    #
    # NOTE: If you get errors that your network is still in use do this:
    #     docker network disconnect -f net-distro quanta-distro
    #     docker network disconnect -f net-distro quanta-distro
    docker-compose -f ${docker_compose_yaml} stop -t 30 $1
    docker-compose -f ${docker_compose_yaml} rm -f -s $1
    # docker ps
    # read -p "service $1 should be missing in above"
}
export -f dockerDown


