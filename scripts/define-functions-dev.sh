#!/bin/bash
set +a # makes all functions get exported

makeDirs () {
    sudo mkdir -p ${PGADMIN_DATA}
    sudo chown -R 5050:5050 ${PGADMIN_DATA}

    sudo mkdir -p ${POSTGRES_DATA}
    sudo mkdir -p ${MONGO_DATA}

    mkdir -p ${QUANTA_BASE}/log
    mkdir -p ${QUANTA_BASE}/tmp
    mkdir -p ${QUANTA_BASE}/config
}

set -a
