set dotenv-load

root_dir := justfile_directory()

degit source_dir target_dir:
  degit https://github.com/KubrickCode/general/{{ source_dir }} {{ target_dir }}

install-degit:
  #!/usr/bin/env bash
  if ! command -v degit &> /dev/null; then
    npm install -g degit
  fi
