set dotenv-load := true

root_dir := justfile_directory()
extension_dir := root_dir / "extension"
server_dir := root_dir / "server"

build:
    cd {{ extension_dir }} && pnpm build

package: build
    #!/usr/bin/env bash
    cd {{ extension_dir }}
    rm -f extension.zip
    cd dist && zip -r ../extension.zip ./*
    echo "✅ Extension packaged to extension/extension.zip"

clean:
    cd {{ extension_dir }} && rm -rf dist node_modules

deps: deps-root deps-extension

deps-root:
    pnpm install

deps-extension:
    cd {{ extension_dir }} && pnpm install

rebuild: clean deps build

release:
    @echo "🚀 Starting release process..."
    @echo "📦 Merging main to release branch..."
    git checkout release
    git merge main
    git push origin release
    git checkout main
    @echo ""
    @echo "✅ Release branch updated!"
    @echo "🔄 GitHub Actions will now:"
    @echo "   1. Analyze commits for version bump"
    @echo "   2. Generate release notes"
    @echo "   3. Create tag and GitHub release"
    @echo "   4. Update CHANGELOG.md"
    @echo "   5. Build and upload to Chrome Web Store"
    @echo ""
    @echo "📊 Check progress: https://github.com/KubrickCode/github-project-status-viewer/actions"

typecheck:
    cd {{ extension_dir }} && pnpm tsc --noEmit

watch:
    cd {{ extension_dir }} && pnpm watch

test:
    just test-server
    just test-extension

test-extension:
    cd {{ extension_dir }} && pnpm test

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
        npx prettier --write "{{ extension_dir }}/src/**/*.ts"
        cd "{{ extension_dir }}"
        pnpm lint
        ;;
      server)
        gofmt -w "{{ server_dir }}"
        ;;
      config)
        npx prettier --write "**/*.{json,yml,yaml,md}"
        ;;
      justfile)
        just --fmt --unstable
        ;;
      *)
        echo "Unknown target: {{ target }}"
        exit 1
        ;;
    esac
