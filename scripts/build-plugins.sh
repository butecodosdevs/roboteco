#!/bin/sh
# Builds the example plugin and the test fixture into plugins/dist. Needs Rust (wasm32-unknown-unknown).
set -eu
cd "$(dirname "$0")/.."
mkdir -p plugins/dist

(cd plugins/hello-rust && cargo build --release --target wasm32-unknown-unknown --quiet)
cp plugins/hello-rust/target/wasm32-unknown-unknown/release/hello_rust.wasm plugins/dist/hello.wasm

(cd plugins/fixtures/contract-rust && cargo build --release --target wasm32-unknown-unknown --quiet)
cp plugins/fixtures/contract-rust/target/wasm32-unknown-unknown/release/contract_rust.wasm plugins/dist/contract.wasm

ls -la plugins/dist
