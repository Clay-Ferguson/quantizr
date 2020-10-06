## Docker

### Installing Docker on Ubuntu 20.04

https://askubuntu.com/questions/1230189/how-to-install-docker-community-on-ubuntu-20-04-lts

https://docs.docker.com/engine/install/ubuntu/

### Install from Ubuntu app store 

    sudo apt install docker.io
    docker --version

### Install Docker Compose

https://www.techiediaries.com/ubuntu/install-docker-19-docker-compose-ubuntu-20-04/

    sudo apt install docker-compose
    docker-compose --version

The rest of these commands need to run and are the same as the old steps below.

    sudo systemctl enable docker
    sudo service docker status

Run this to init a local registry

    sudo docker run -d -p 5000:5000 --restart=always --name registry registry:2

Allow running docker without 'sudo' (two commands below):

https://docs.docker.com/install/linux/linux-postinstall/

    sudo groupadd docker
    sudo usermod -aG docker $USER

Note: do logout/login in linux after running these two lines above.

### Docker Tips

#### NOTE

After the cleanup below we *might* (i'm not sure) need to run this again:

    sudo docker run -d -p 5000:5000 --restart=always --name registry registry:2

#### To cleanup:

(doesn't seem to remove EVERYTHING)

    docker system prune

#### To remove all containers,

    # switch to root.
    su -

    docker rm -vf $(docker ps -a -q)

-v: Remove all associated volumes

-f: Forces the removal. Like, if any containers is running, you need -f to remove them.

#### To remove all images,

    # switch to root.
    su -

    docker rmi -f $(docker images -a -q)

-a: for all containers, even not running, (or images)

-q: to remove all the details other than the ID of containers (or images)

### Docker Maintenance

### Docker Disk Space Usage

Docker tends to fill up a hard drive by keeping too many images here:

```
/var/lib/docker/overlay2
```

Here's how to clean it up, by deleting files that are not needed:

```sh
# check disk space
df -h

sudo -i

docker image prune --all

docker system prune -a
```

