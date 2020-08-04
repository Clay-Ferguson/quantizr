## Quanta IPFS Integration

Quanta has the ability to upload to https://temporal.cloud but it also has it's own IPFS Gateway instance built into the codebase and Docker Compose file. See the yaml files to find that config.

## Testing IPFS Gateway

After you start the docker instance using `docker-compose-dev.yaml` you should able to go to this URL and get back a result:

http://localhost:8080/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/readme

The above hash is from the core IPFS team and should always be available, and be permanently pinned.