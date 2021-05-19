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

dockerBuildUp () {
    # I was seeing docker fail to deploy new code EVEN after I'm sure i built new code, and ended up finding
    # this stackoverflow saying how to work around this (i.e. first 'build' then 'up') 
    # https://stackoverflow.com/questions/35231362/dockerfile-and-docker-compose-not-updating-with-new-instructions
    echo "dockerBuildUp"

    docker-compose -f ${docker_compose_yaml} build --no-cache
    verifySuccess "Docker Compose: build"

    docker-compose -f ${docker_compose_yaml} up -d
    verifySuccess "Docker Compose: up"

    # sleep 10
    # echo "Sleeping 10 seconds before checking logs"
    # docker-compose -f ${docker_compose_yaml} logs $1
    # verifySuccess "Docker Compose: logs"
}
export -f dockerBuildUp

dockerDown () {
    echo "dockerDown ${docker_compose_yaml} serivce $1"

    # NOTE: with remove-orphans it takes down not just what's in our YAML but 
    # also every other docker thing running on the machine!
    # docker-compose -f ${docker_compose_yaml} down --remove-orphans
    # docker-compose -f ${docker_compose_yaml} stop $1
    docker-compose -f ${docker_compose_yaml} rm -f -s $1
    # docker ps
    # read -p "service $1 should be missing in above"
}
export -f dockerDown

makeDirs () {
    mkdir -p ${QUANTA_BASE}/log
    mkdir -p ${QUANTA_BASE}/tmp
    mkdir -p ${QUANTA_BASE}/config
    mkdir -p ${QUANTA_BASE}/lucene

    mkdir -p ${ipfs_data}
    mkdir -p ${ipfs_staging}
}
export -f makeDirs

