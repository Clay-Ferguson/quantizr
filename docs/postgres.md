# PostgreSQL Notes

Currently (as of 10/05/23) Quanta doesn't use Postgre for anything, but we are adding Postgre going forward so we have SQL capabilities for certain pieces of system information.

## Postgre Docker Compose

See the docker compose yaml files for configuration details. Our Postgre instance, like every other component of Quanta is using docker.

## Postgre Admin (pgAdmin4)

In the docker compose yaml file, there is a section (currently commented out) which can run pgAdmin4 right from inside the docker instance, but it's commented because there's currently no justification for consuming expensive server-side resources for managing the database when we can manage it remotely instead.

The way we do this is by running a separate dockerized pgAdmin4 instance from some other maching like this:

```sh
docker run -p 5050:80 \
    -e 'PGADMIN_DEFAULT_EMAIL=user@domain.com' \
    -e 'PGADMIN_DEFAULT_PASSWORD=SuperSecret' \
    -d dpage/pgadmin4
```

Once you login to the admin console, here are the connection settings that can get you connected to a locally running (like during development) instance of the Quanta app and it's Postgres instance:

Connection Host: 172.17.0.1
Database: quanta-pg
User: quanta-pg
Password: ******

*Note: The 172.17.0.1 is a special docker address for the host machine as seen from inside the pgAdmin4 container. Obviously we can't just use 127.0.0.1 inside the pgAdmin4 dockerk container because that IP would point to the container itself, from inside the container, where pgAdmin4 is running.*

