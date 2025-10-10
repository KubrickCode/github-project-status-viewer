set dotenv-load

root_dir := justfile_directory()
extension_dir := root_dir / "extension"
server_dir := root_dir / "server"

build:
  cd {{ extension_dir }} && yarn build

package: build
  #!/usr/bin/env bash
  cd {{ extension_dir }}
  rm -f extension.zip
  cd dist && zip -r ../extension.zip ./*
  echo "✅ Extension packaged to extension/extension.zip"

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

go-test:
  cd {{ server_dir }} && \
  JWT_SECRET=test-secret \
  KV_REST_API_URL=http://test-redis.local \
  KV_REST_API_TOKEN=test-token \
  GITHUB_CLIENT_ID=test-client-id \
  GITHUB_CLIENT_SECRET=test-client-secret \
  CHROME_EXTENSION_ID=test-extension-id \
  go test -v ./pkg/...
