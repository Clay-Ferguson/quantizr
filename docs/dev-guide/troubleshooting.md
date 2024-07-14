**[Quanta](/docs/index.md) / [Quanta-Developer-Guide](/docs/dev-guide/index.md)**

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
    * [Docker service fails to start](#docker-service-fails-to-start)

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

# Docker service fails to start

Here are some troubleshooting tips from ChatGPT, for the situation where one of the services of the swarm fails to start and `docker ps -a` also doesn't even show the service. The answer below was given to me during troubleshooting why `quanta-stack-distro_quanta-distro` was failing to start, and it ended up being an issue with Certbot configuration in my case, but the troubleshooting below will be helpful for many different scenarios.

When dealing with a Docker service in a Swarm that isn't starting, and where logs aren't showing up, it can be particularly challenging to diagnose the issue. Given that you hinted it might be network-related, especially after recent changes involving certificates and possibly network settings, here are some steps you can follow to troubleshoot the issue:

## 1. Check Service Status
First, ensure the service is actually recognized and attempted to be started by Docker Swarm:

```bash
docker service ls
```

Look for the service `quanta-stack-distro_quanta-distro` and check its REPLICAS column. If the numbers are `0/1` or similar, it means the service is recognized but no instances are running.

## 2. Inspect Service
Inspect the service to see if there are any configurations that might be causing issues:

```bash
docker service inspect quanta-stack-distro_quanta-distro
```

Pay attention to the "Networks" section to see if it's correctly configured. Also, look at the "TaskSpec" to ensure all parameters such as environment variables, mounts, etc., are correctly set.

## 3. Check Service Tasks
Since `docker service logs` didn't show anything, check the tasks for the service to see their state:

```bash
docker service ps quanta-stack-distro_quanta-distro --no-trunc
```

This command shows the tasks and their current state. If tasks are in a "Pending" or "Rejected" state, it can give you clues as to why the service isn't starting.

## 4. Network Troubleshooting
Since the issue may be network-related:

## a. Network Inspect
Inspect the network to which the service is connected:

```bash
docker network inspect [network_name]
```

Check for any anomalies or misconfigurations, especially related to subnets, gateways, or attached services.

## b. Check Connectivity
If possible, try pinging or connecting to relevant network resources or services manually from within another container on the same network.

## 5. Check System Resources
Sometimes, services fail to start because of insufficient system resources (CPU, memory, disk space):

```bash
df -h
free -m
```

## 6. Docker Daemon and System Logs
Since `docker service logs` isn't showing anything, consider looking at the Docker daemon logs or system logs:

```bash
## For Docker daemon logs (the exact command can vary by system)
journalctl -u docker.service

## General system logs
dmesg
```

## 7. Configuration Issues
Review any recent changes to Docker Compose files or Dockerfile. Ensure that environment variables, especially those related to networks or certificates, are correct.

## 8. Restart Docker Swarm Services
Sometimes, a simple restart can help if there are transient issues:

```bash
docker service scale quanta-stack-distro_quanta-distro=0
docker service scale quanta-stack-distro_quanta-distro=1
```

## 9. Check Certificates and Ports
Ensure that no other service is using the ports assigned to your service and check that the certificates are correctly mounted and valid.

## Conclusion
If after all these steps the issue remains unresolved, consider isolating the component outside of Docker Swarm (e.g., in a standalone Docker container) to see if it starts successfully. This can help determine if the issue is with the application itself or the Swarm configuration.


----
**[Next: Demo-Content](/docs/demo-content/index.md)**
