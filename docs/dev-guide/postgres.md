**[Quanta](/docs/index.md) / [Quanta-Technical-Docs](/docs/dev-guide/index.md)**

# PostgreSQL

# PostgreSQL Notes

Postgres is used to hold a transactions table which keeps track of financial expendatures for all users. The only kinds of expendatures currently are the OpenAI API charges, for access to ChatGPT

# Postgre Docker Compose

See the docker compose yaml files for configuration details. Our Postgre instance, like every other component of Quanta is using docker.

# Postgre Admin

In the docker compose yaml file, there is a section (currently commented out) which can run pgAdmin4 right from inside the docker instance, but it's commented because there's currently no justification for consuming expensive server-side resources for managing the database when we can manage it remotely instead.

The way we do this is by running a separate dockerized pgAdmin4 instance from some other machine like this:

```sh
docker pull dpage/pgadmin4
docker run -p 5051:80 \
    -e 'PGADMIN_DEFAULT_EMAIL=user@none.com' \
    -e 'PGADMIN_DEFAULT_PASSWORD=password' \
    -d dpage/pgadmin4
```

Makes server avilable at http://127.0.0.1:5051

Or by running an instance of pgAdmin from inside a docker compose file locally as is done in `dc-dev.yaml`, which is the development config.

Assuming we're using the config in `dc-dev.yaml', once you login to the admin console at `http://127.0.0.1:5051`, here are the connection settings that can get you connected DB instance of the Quanta app and it's Postgres instance, and in the case below it's the dev db:

```txt
Connection Host: pgdb-host-dev
Port: 5432 <--- note this is the internal port not the one in our env var
Maintenance Database: postgres
User: quanta-pg
Password: see: ${pgPassword}
```


----
**[Next: Troubleshooting](/docs/dev-guide/troubleshooting.md)**
