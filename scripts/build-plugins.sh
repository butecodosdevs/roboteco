#!/bin/sh
# Builds the example WASM plugins into plugins/dist. Needs Rust (wasm32-unknown-unknown) and Go 1.24+.
set -eu
cd "$(dirname "$0")/.."
mkdir -p plugins/dist

(cd plugins/hello-rust && cargo build --release --target wasm32-unknown-unknown --quiet)
cp plugins/hello-rust/target/wasm32-unknown-unknown/release/hello_rust.wasm plugins/dist/hello.wasm

(cd plugins/coin-go && GOOS=wasip1 GOARCH=wasm go build -buildmode=c-shared -o ../dist/coin.wasm .)

for fixture in evil greedy; do
  (cd "plugins/fixtures/$fixture-rust" && cargo build --release --target wasm32-unknown-unknown --quiet)
  cp "plugins/fixtures/$fixture-rust/target/wasm32-unknown-unknown/release/${fixture}_rust.wasm" "plugins/dist/$fixture.wasm"
done

ls -la plugins/dist
