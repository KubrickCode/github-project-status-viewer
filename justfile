set dotenv-load

root_dir := justfile_directory()

degit source_dir target_dir:
  degit https://github.com/KubrickCode/general/{{ source_dir }} {{ target_dir }}

install-degit:
  #!/usr/bin/env bash
  if ! command -v degit &> /dev/null; then
    npm install -g degit
  fi

generate-env:
  #!/usr/bin/env bash
  set -euox pipefail

  if [[ ! -f .doppler.env ]]; then
    echo "Error: .doppler.env file not found."
    exit 1
  fi
  source .doppler.env

  if [[ -z "${DOPPLER_TOKEN_ROOT:-}" ]]; then
    echo "Error: DOPPLER_TOKEN_ROOT not set in .doppler.env."
    exit 1
  fi
  if [[ -z "${DOPPLER_TOKEN_VITE:-}" ]]; then
    echo "Error: DOPPLER_TOKEN_VITE not set in .doppler.env."
    exit 1
  fi

  echo "Downloading secrets for dev_root..."
  doppler secrets download --project loa-work --config dev_root --format env --no-file --token "${DOPPLER_TOKEN_ROOT}" | sed 's/"//g' > .env

  echo "Environment files generated successfully."

# Run pgadmin
# When connecting to DB, the host name must be `host.docker.internal`.
pgadmin:
  #!/usr/bin/env bash
  container=notag_pgadmin
  if docker start $container &> /dev/null; then
    echo "Container $container started."
  else
    echo "Failed to start container $container. Creating a new one..."
    docker run \
      --name $container \
      -e PGADMIN_DEFAULT_EMAIL=admin@example.com \
      -e PGADMIN_DEFAULT_PASSWORD=admin \
      -e PGADMIN_CONFIG_SERVER_MODE=False \
      -e PGADMIN_CONFIG_MASTER_PASSWORD_REQUIRED=False \
      -p 8080:80 \
      dpage/pgadmin4
  fi
