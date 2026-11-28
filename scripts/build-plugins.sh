#!/bin/sh
# Builds the example WASM plugins into plugins/dist. Needs Rust (wasm32-unknown-unknown) and Go 1.24+.
set -eu
cd "$(dirname "$0")/.."
mkdir -p plugins/dist

(cd plugins/hello-rust && cargo build --release --target wasm32-unknown-unknown --quiet)
cp plugins/hello-rust/target/wasm32-unknown-unknown/release/hello_rust.wasm plugins/dist/hello.wasm

(cd plugins/activity-rust && cargo build --release --target wasm32-unknown-unknown --quiet)
cp plugins/activity-rust/target/wasm32-unknown-unknown/release/activity_rust.wasm plugins/dist/activity.wasm

(cd plugins/coin-go && GOOS=wasip1 GOARCH=wasm go build -buildmode=c-shared -o ../dist/coin.wasm .)
(cd plugins/remind-go && GOOS=wasip1 GOARCH=wasm go build -buildmode=c-shared -o ../dist/remind.wasm .)

for fixture in evil greedy contract; do
  (cd "plugins/fixtures/$fixture-rust" && cargo build --release --target wasm32-unknown-unknown --quiet)
  cp "plugins/fixtures/$fixture-rust/target/wasm32-unknown-unknown/release/${fixture}_rust.wasm" "plugins/dist/$fixture.wasm"
done

ls -la plugins/dist
