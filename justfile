set dotenv-load := true

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

deps:
    cd {{ extension_dir }} && yarn install

rebuild: clean deps build

release version="patch":
    #!/usr/bin/env bash
    set -e
    echo "🚀 Creating {{ version }} release..."

    npm version {{ version }} --no-git-tag-version
    NEW_VERSION=$(node -p "require('./package.json').version")

    cd {{ extension_dir }}/public
    cat manifest.json | jq --arg v "$NEW_VERSION" '.version = $v' > manifest.json.tmp
    mv manifest.json.tmp manifest.json
    cd {{ root_dir }}

    git add package.json extension/public/manifest.json
    git commit -m "bump version to $NEW_VERSION"
    git tag "v$NEW_VERSION"

    git push origin main --tags
    git checkout release
    git merge main
    git push origin release
    git checkout main

    echo "✅ Release complete! Check GitHub Actions."

typecheck:
    cd {{ extension_dir }} && yarn tsc --noEmit

watch:
    cd {{ extension_dir }} && yarn watch

test-server:
    cd {{ server_dir }} && \
    JWT_SECRET=test-secret \
    KV_REST_API_URL=http://test-redis.local \
    KV_REST_API_TOKEN=test-token \
    GITHUB_CLIENT_ID=test-client-id \
    GITHUB_CLIENT_SECRET=test-client-secret \
    CHROME_EXTENSION_ID=test-extension-id \
    go test -v ./pkg/...

lint target="all":
    #!/usr/bin/env bash
    set -euox pipefail
    case "{{ target }}" in
      all)
        just lint extension
        just lint server
        just lint config
        just lint justfile
        ;;
      extension)
        prettier --write "{{ extension_dir }}/src/**/*.ts"
        cd "{{ extension_dir }}"
        yarn lint
        ;;
      server)
        gofmt -w "{{ server_dir }}"
        ;;
      config)
        prettier --write "**/*.{json,yml,yaml,md}"
        ;;
      justfile)
        just --fmt --unstable
        ;;
      *)
        echo "Unknown target: {{ target }}"
        exit 1
        ;;
    esac
