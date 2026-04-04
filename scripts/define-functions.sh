#!/bin/bash

echo "Defining Functions..."
set +a # makes all functions get exported

verifySuccess () {
    if [ $? -eq 0 ]; then
        echo "$1 successful."
    else
        echo "$1 failed. EXIT CODE: $?"
        read -p "Press ENTER."
        exit $?
    fi
}

serviceCheck () {
    if docker service inspect $1 | grep $1; then
        echo "service $1 started ok"
    else
        # if this fails can that mean you just didn't give docker enough time? So maybe it was in process of starting?
        read -p "service $1 failed to start"
    fi
}

# It's too easy to run something that can cause this file to exist and that really can scre
# up the project since we're using yarn. So we check for it, a lot.
yarnCheck () {
    if [ -e "${PRJROOT}/src/main/resources/public/package-lock.json" ]; then
        echo "*******************************************************"
        echo "Oops. package-lock.json found. This should not exist with 'yarn' being used."
        rm ${PRJROOT}/src/main/resources/public/package-lock.json
        echo "Deleted package-lock.json. Continuing..."
        echo "*******************************************************"
        # read -p "Press ENTER."
        # exit $?
    # else
    #     echo "No package-lock.json found ($1)  Good."
    fi
}

imageCheck () {
    if docker images --format '{{.Repository}}:{{.Tag}}' | grep "^$1:"; then
        echo "image $1 exists"
    else
        # if this fails can that mean you just didn't give docker enough time? So maybe it was in process of starting?
        read -p "image $1 does not exist"
    fi
}

# If you get the buld error: failed to solve: failed to walk: resolve : lstat /var/lib/docker/overlay2/diff: no such file or directory
# try running this docker-comkpose with "--no-cache" option like this:
#     docker-compose -f ${dc_yaml} build --no-cache
# NOTE: There's a --verbose option that can be added to the build command to see more details, in the latest version?
dockerBuild () {
    echo "dockerBuild: full app"
    # docker-compose -f ${dc_yaml} build --no-cache
    docker-compose -f ${dc_yaml} build --parallel
    verifySuccess "Docker Compose: build app"
}

dockerBuildService () {
    echo "dockerBuild: Service $1"
    docker-compose -f ${dc_yaml} build $1
    verifySuccess "Docker Compose: build $1"
}

dockerUp() {
    echo "Deploying stack"
    docker stack deploy -c ${dc_yaml} ${docker_stack}
    verifySuccess "Stack deployed."

    echo "waiting ${DOCKER_UP_DELAY}, after deploying..."
    sleep ${DOCKER_UP_DELAY}
}

# stops just our web app, leaving all containers up and running. In a swarm environment this is the best
# way to 'restart' a service. Scale it down to zero, to shut down, and then scale it back up.
dockerDownQuanta() {
    echo "Stopping Container (by Scale=0): ${docker_stack}_quanta-${DOCKER_ENV}"
    docker service scale ${docker_stack}_quanta-${DOCKER_ENV}=0
}

dockerUpQuanta() {
    echo "Starting Container (by Scale=1): ${docker_stack}_quanta-${DOCKER_ENV}"
    docker service scale ${docker_stack}_quanta-${DOCKER_ENV}=1
}

dockerDown() {
    echo "Stopping docker stack"
    docker stack rm ${docker_stack}
    echo "waiting ${DOCKER_DOWN_DELAY} after stack removed..."
    sleep ${DOCKER_DOWN_DELAY}
}

printUrlsMessage() {
    echo ================================================
    echo Quanta is Running at: http://${quanta_domain}:${HOST_PORT}
    # echo To Test: curl -X POST  http://${quanta_domain}:${HOST_PORT}/api/ping -H "Accept: application/json" -H "Content-Type: application/json" -d "{}"
    echo ================================================
    read -p "Press enter key."
}

makeMongoKeyFile () {
    if [ ! -e "${MONGO_KEY}" ]; then
        echo "Creating MongoDB Key file: ${MONGO_KEY}"
        openssl rand -base64 756 > ${MONGO_KEY}
    else
        echo "MongoDB Key file exists: ${MONGO_KEY}"
    fi
    sudo chmod 600 ${MONGO_KEY}
    sudo chown 999:999 ${MONGO_KEY}
}

# Generates the init-replia.sh script that's used by Mongo automatically when the container starts.
genInitReplica () {
    echo "Generating MongoDB Config: ${INIT_REPLICA}"
cat > ${INIT_REPLICA} <<- EOM
#!/bin/bash
mongosh -u root -p ${mongoPassword} --port ${MONGO_PORT} --host ${MONGO_HOST} --quiet <<EOF
  rs.initiate(
    {
      _id: "rs0",
      members: [
        { _id: 0, host: "${MONGO_HOST}:${MONGO_PORT}" }
      ]
    }
  );
EOF
EOM
    # make file executable
    chmod +x ${INIT_REPLICA}
}

runInitReplica () {
    echo "Sleeping 20s before Running init_replica.sh"
    sleep 20s

    # Get the container ID based on the image name
    CONTAINER_ID=$(docker ps -q -f name=${docker_stack}_mongo-${DOCKER_ENV}*)

    # Check if a container was found
    if [ -z "$CONTAINER_ID" ]; then
        echo "No MongoDb container found matching ${docker_stack}_mongo-${DOCKER_ENV}*"
        exit 1
    else 
        echo "Running init_replica.sh in container: ${CONTAINER_ID}"
        docker exec ${CONTAINER_ID} /bin/bash -c './init/init-replica.sh'
    fi
}

# tip: the "<<" operator below is called a "here document" in Linux terminology.
genMongoConfig() {
    echo "Generating MongoDB Config: ${MONGOD_CONF}"
cat > ${MONGOD_CONF} <<- EOM
# NOTE: This file is generated by the builder.
net:
    port: ${MONGO_PORT}
    bindIpAll: true

security:
    authorization: enabled
    keyFile: /data/mongo-key

replication:
    replSetName: "rs0"    
EOM
}

# If there's any syntax errors in the above script we never make it here and so we use the existance of this
# fuction to see if we ran this ok.
checkFunctions() {
    echo "Functions Defined Ok."
}

# Define the askYesOrNo function
askYesOrNo() {
    local question="$1"
    
    # Prompt the user for a single character "y" or "n"
    read -n 1 -p "$question (y/n): " answer
    echo
    
    # Check if the answer is "y" (case-insensitive)
    if [[ "$answer" =~ ^[Yy]$ ]]; then
        return 0
    else
        return 1
    fi
}

# Example of using the askYesOrNo function
# if askYesOrNo "Do you want to say hi?"; then
#     echo "hi there"
# else
#     echo "You chose not to say hi."
# fi

set -a
echo "Functions ready"

