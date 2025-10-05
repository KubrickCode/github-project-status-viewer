set dotenv-load

root_dir := justfile_directory()

build:
  yarn build

clean:
  rm -rf dist node_modules

degit source_dir target_dir:
  degit https://github.com/KubrickCode/general/{{ source_dir }} {{ target_dir }}

deps:
  yarn install

install-degit:
  #!/usr/bin/env bash
  if ! command -v degit &> /dev/null; then
    npm install -g degit
  fi

rebuild: clean deps build

typecheck:
  yarn tsc --noEmit

watch:
  yarn watch
