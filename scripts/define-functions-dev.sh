#!/bin/bash

makeDirs () {
    mkdir -p ${QUANTA_BASE}/log
    mkdir -p ${QUANTA_BASE}/tmp
    mkdir -p ${QUANTA_BASE}/config
    mkdir -p ${QUANTA_BASE}/lucene

    mkdir -p ${ipfs_data}
    mkdir -p ${ipfs_staging}
}
export -f makeDirs
