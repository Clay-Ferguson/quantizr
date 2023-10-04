## How to Compile/Build Quanta

To build and start an instance of Quanta on localhost for deveopment use `/scripts/build-dev.sh` which is configured by the settings in `setenv-dev.sh`

If you then edit only TypeScript files and want to test those changes you can run just `build-vite.sh` to make those changes go live.

## Production Builds

If you've already understood `build-dev.sh` and how it works you'll notice `build-distro.sh` (used for doing production builds) is very similar.
