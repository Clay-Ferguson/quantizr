# Docker

## NOTE

After the cleanup below we *might* (i'm not sure) need to run this again:

    sudo docker run -d -p 5000:5000 --restart=always --name registry registry:2

## To cleanup:

(doesn't seem to remove EVERYTHING)

    docker system prune

## To remove all containers,

    # switch to root.
    su -

    docker rm -vf $(docker ps -a -q)

-v: Remove all associated volumes

-f: Forces the removal. Like, if any containers is running, you need -f to remove them.

## To remove all images,

    # switch to root.
    su -

    docker rmi -f $(docker images -a -q)

-a: for all containers, even not running, (or images)

-q: to remove all the details other than the ID of containers (or images)    

