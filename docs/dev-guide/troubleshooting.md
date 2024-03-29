**[Quanta](/docs/index.md) / [Quanta Developer Guide](/docs/dev-guide/index.md)**

* [Troubleshooting](#troubleshooting)
    * [Healthcheck Results](#healthcheck-results)
    * [Realtime Monitoring Console ](#realtime-monitoring-console-)
    * [Check to see what Docker has Running](#check-to-see-what-docker-has-running)
    * [Check Docker Images](#check-docker-images)
    * [Inspect your Docker Repository](#inspect-your-docker-repository)
    * [Check Docker Logs](#check-docker-logs)
    * [Delete all Images](#delete-all-images)
    * [To Remove Most Running things](#to-remove-most-running-things)
    * [To Cleanup Disk Space](#to-cleanup-disk-space)

# Troubleshooting

If something doesn't work, here's some tips to troubleshoot docker and the app. These are just some random notes and commands that might come in handy during troubleshooting something going wrong the app or anything related to docker

# Healthcheck Results

    docker inspect --format "{{json .State.Health }}" <container-name>

# Realtime Monitoring Console 

Monitoring CPU & Memory

    docker stats

# Check to see what Docker has Running

    docker ps
    docker network ls
    docker service ls

Should show something like these two: 'subnode/repo:quanta1.0.26' and 'mongo:4.0'

# Check Docker Images

https://docs.docker.com/engine/reference/commandline/image_ls/

    docker image ls --digests | grep "quanta"
    docker image ls --digests | grep "mongo"

# Inspect your Docker Repository

    docker image inspect subnode/repo:quanta1.0.26

The "RepoDigests" in the output should contain the same digest shown in the "hub.docker.com" website.

# Check Docker Logs

    docker logs <container-name>
    docker service logs <service-name>

    If container can't even start run `docker ps -a` to get it's container ID, and then run
    docker logs <container_id>

# Delete all Images

https://codenotary.com/blog/extremely-useful-docker-commands

First stop everything:

    docker stack ls

    docker stack rm quanta-stack-local
    docker stack rm quanta-stack-dev

Stop all images

    docker stop $(docker ps -a -q) 

Just as an extra check do a prune first:

    docker system prune -a
    docker image prune -a

Removes all images

    docker rmi -f $(docker images -aq)

Print all images (should be empty now)

    docker images

Stop docker just to force it to reload and know NO images exist
(just a paranoia step
)
    sudo systemctl stop docker

Bring it back up

    sudo systemctl start docker

    
# Try to Pull again. 

Should tell you image is already up to date

    docker image pull subnode/repo:quanta1.0.26

# To Remove Most Running things

    docker kill $(docker ps -q)

    docker stack ls
    docker stack rm ${stack_name}

    docker service ls
    docker service rm ${serice_name}

    docker network ls
    docker network prune

# To Cleanup Disk Space

    docker system prune -a
    docker image prune -a


----
**[Next: Demo Content](/docs/demo-content/index.md)**
