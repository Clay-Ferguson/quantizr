**[Quanta](/docs/index.md) / [Quanta Developer Guide](/docs/dev-guide/index.md)**

# Backup and Restore

# Backing up and Restoring Entire MongoDB Database

In the `[proj]/scripts/tools` folder you will find _backup.sh and _restore.sh. Those two scripts must be put in the folder that the docker compose yaml file volume maps to "/backup". These two files (starting with underscores) will be executed from within the MongoDB container.

You'll need to hand edit those files to substitute in the appropriate variables.

# Running the scripts

Here's how you can execute those scripts inside the MongoDB container from the host without having to log into the container:

Note: for an interactive terminal insert "-it" (without the quotes) after the 'exec'

Use `docker ps` to get container id

    docker exec ${containerId} /backup/_backup.sh

    docker exec ${containerId} /backup/_restore.sh


----
**[Next: Docker Install](/docs/dev-guide/docker-install.md)**
