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
