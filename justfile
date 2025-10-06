set dotenv-load

root_dir := justfile_directory()
extension_dir := root_dir / "extension"

build:
  cd {{ extension_dir }} && yarn build

clean:
  cd {{ extension_dir }} && rm -rf dist node_modules

degit source_dir target_dir:
  degit https://github.com/KubrickCode/general/{{ source_dir }} {{ target_dir }}

deps:
  cd {{ extension_dir }} && yarn install

install-degit:
  #!/usr/bin/env bash
  if ! command -v degit &> /dev/null; then
    npm install -g degit
  fi

rebuild: clean deps build

release version="patch":
    @echo "🚀 Creating {{version}} release..."
    npm version {{version}}
    git push origin main --tags
    git checkout release
    git merge main
    git push origin release
    git checkout main
    @echo "✅ Release complete! Check GitHub Actions."

typecheck:
  cd {{ extension_dir }} && yarn tsc --noEmit

watch:
  cd {{ extension_dir }} && yarn watch
