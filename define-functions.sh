#!/bin/bash

verifySuccess () {
    if [ $? -eq 0 ]; then
        echo "$1 successful."
    else
        echo "$1 failed. EXIT CODE: $?"
        exit $?
    fi
}