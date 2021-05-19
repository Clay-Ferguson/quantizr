# Quanta Distro

### How to run a Quanta instance

To run a Quanta instance from the Docker Public Repository you can simply unzip the `quanta-1.0.1.tar.gz` onto a linux machine, and then start the app with `run-distro.sh`. This will create a minimal installation running at `http://localhost:8185`, and will be persisting all data into a MongoDB in the `\data` subfolder inside your distro folder. To stop the app run `stop-distro.sh`. To run on a different port, just edit the `docker-compose-distro.yaml`. If you want to customize the branding you can replace or edit the content in the `config` and/or `branding` folders.

The only prerequisite is that you need to have `docker-compose` installed first.

NOTE: You should edit the password in `mongo.env` and `secrets.sh`, before your first run, and that password will become your `admin` user password which you can use to login as the `admin` user. This same password will be securing your MongoDB instance and will also be the admin password for the Web App.

****

**Welcome to the Fediverse!**


