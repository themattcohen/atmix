#!/bin/bash
set -e

# Create application users
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER fbar_b2b WITH PASSWORD '$POSTGRES_B2B_PASSWORD';
    CREATE USER fbar_d2c WITH PASSWORD '$POSTGRES_D2C_PASSWORD';

    CREATE DATABASE fbar_direct;

    ALTER DATABASE fbar_automator OWNER TO fbar_b2b;
    ALTER DATABASE fbar_direct OWNER TO fbar_d2c;

    REVOKE CONNECT ON DATABASE fbar_automator FROM PUBLIC;
    REVOKE CONNECT ON DATABASE fbar_direct FROM PUBLIC;
    GRANT CONNECT ON DATABASE fbar_automator TO fbar_b2b;
    GRANT CONNECT ON DATABASE fbar_direct TO fbar_d2c;
EOSQL

# Fix public schema ownership inside fbar_automator
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "fbar_automator" <<-EOSQL
    ALTER SCHEMA public OWNER TO fbar_b2b;
EOSQL

# Fix public schema ownership inside fbar_direct
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "fbar_direct" <<-EOSQL
    ALTER SCHEMA public OWNER TO fbar_d2c;
EOSQL
