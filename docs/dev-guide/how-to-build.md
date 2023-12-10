**[Quanta](/docs/index.md) / [Quanta Developer Guide](/docs/dev-guide/index.md)**

# How to Build

# How to Build Quanta

To build and start an instance of Quanta on localhost for deveopment use `/scripts/build-dev.sh` which is configured by the settings in `setenv-dev.sh`

# Front-end Hot Deploy

If you have the server running and you then edit only TypeScript files, or other front-end files, and want to test those changes you can run just `build-vite.sh` to make those changes go live in the running server.

# Back-end Hot Deploy

Likewise, if you have the server running and you then edit only Java files, and want to test those changes you can run just `build-dev-java.sh` to make those changes go live in the server running server.

# Production Builds

If you've already understood `build-dev.sh` and how it works you'll notice `build-distro.sh` (used for doing production builds) is very similar.


----
**[Next Page -> How to Run](/docs/dev-guide/how-to-run.md)**
