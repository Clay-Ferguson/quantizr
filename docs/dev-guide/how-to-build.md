**[Quanta](/docs/index.md) / [Quanta Developer Guide](/docs/dev-guide/index.md)**

* [How to Build](#how-to-build)
    * [Front-End Notes](#front-end-notes)
    * [How to Build Quanta - Dev Mode](#how-to-build-quanta---dev-mode)
    * [Front-end Hot Deploy](#front-end-hot-deploy)
    * [Back-end Hot Deploy](#back-end-hot-deploy)
    * [Production Builds](#production-builds)

# How to Build

# Front-End Notes

* Deployment is build using `vite`

* The project uses `yarn` as the package manager, rather than `npm`.

* It's recommended that you use `nvm` as your way of installing, and managing node versions.

# How to Build Quanta - Dev Mode

To build and start an instance of Quanta on localhost for deveopment use `/scripts/build-dev.sh` which is configured by the settings in `setenv-dev.sh`

# Front-end Hot Deploy

If you have the server running and you then edit only TypeScript files, or other front-end files, and want to test those changes you can run just `build-vite.sh` to make those changes go live in the running server.

# Back-end Hot Deploy

Likewise, if you have the server running and you then edit only Java files, and want to test those changes you can run just `build-dev-java.sh` to make those changes go live in the server running server.

# Production Builds

If you've already understood `build-dev.sh` and how it works you'll notice `build-distro.sh` (used for doing production builds) is very similar.

This script creates the distro folder in `[project]/distro` and updates the local docker repository with the current file image for the QUANTA_VER that's set. Once the docker image is in the docker repo the app can then be run by using the script in the distro folder.


----
**[Next: How to Run](/docs/dev-guide/how-to-run.md)**
