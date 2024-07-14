**[Quanta](/docs/index.md) / [Quanta-Developer-Guide](/docs/dev-guide/index.md)**

* [How to Run](#how-to-run)
    * [How to Run the Quanta Server](#how-to-run-the-quanta-server)
    * [Step 1 - Install Docker](#step-1---install-docker)
    * [Step 2 - Docker Swarm Mode](#step-2---docker-swarm-mode)
    * [Step 3 - Make Runtime Folder](#step-3---make-runtime-folder)
    * [Step 4 - Start and Stop the app](#step-4---start-and-stop-the-app)
    * [Note 1](#note-1)
    * [Note 2](#note-2)

# How to Run

# How to Run the Quanta Server

Quanta uses Docker Compose to run. Here are the steps to run an instance of the Quanta server.

# Step 1 - Install Docker

Install Docker and Docker Compose. You can do that the way you normally do, or if you're not sure how you can refer to the detailed steps in `docker-install.md` file in this folder.

# Step 2 - Docker Swarm Mode

You need to have docker running in 'swarm mode'. Again refer to `docker-install.md` file for complete instructions if you're not sure how to activate swarm mode.

# Step 3 - Make Runtime Folder

Prepare a folder from which you will run the app, which contains all the configuration files, etc. The entire `distro` folder in the root of the project is exactly for this purpose. You should copy that entire folder (including all files and subfolders) to whever you want to run Quanta from. The files in this `distro` folder should work 'as is' to create a minimal functional installation, but of course you can modify any of the config files contained in this folder to setup your real passwords, database folders, etc.

Note that this `distro` folder doesn't contain the actual compiled binaries but will get those form docker repository when you run the app.

# Step 4 - Start and Stop the app

To run a Quanta instance from the Docker Public Repository you can just run `run-distro.sh` from the 'distro' folder. To stop the app run `stop-distro.sh`.

# Note 1

You should edit the passwords in the `setenv-run-distro.sh` file before your first run, because it initializes the MongoDB database and the admin user account with those passwords during the first run.

# Note 2

You'll see in the setenv file that the data folder for MongoDB defaults to `${DEPLOY_TARGET}/data` unless you change it, and when you run the app for the first time that folder must exist, but can be empty. If empty a new database will be created there. Any time you want to wipe the database and start over you can simply delete the files in this data folder (with the server offline) and then restart the server.


----
**[Next: PostgreSQL](/docs/dev-guide/postgres.md)**
