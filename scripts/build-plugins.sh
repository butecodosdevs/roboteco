#!/bin/sh
# Builds the example plugin and the test fixtures into plugins/dist. Needs Rust (wasm32-unknown-unknown)
# and Go 1.24+.
set -eu
cd "$(dirname "$0")/.."
mkdir -p plugins/dist

(cd plugins/hello-rust && cargo build --release --target wasm32-unknown-unknown --quiet)
cp plugins/hello-rust/target/wasm32-unknown-unknown/release/hello_rust.wasm plugins/dist/hello.wasm

(cd plugins/fixtures/contract-rust && cargo build --release --target wasm32-unknown-unknown --quiet)
cp plugins/fixtures/contract-rust/target/wasm32-unknown-unknown/release/contract_rust.wasm plugins/dist/contract.wasm

(cd plugins/fixtures/echo-rust && cargo build --release --target wasm32-unknown-unknown --quiet)
cp plugins/fixtures/echo-rust/target/wasm32-unknown-unknown/release/echo_rust.wasm plugins/dist/echo.wasm

(cd plugins/fixtures/echo-go && GOOS=wasip1 GOARCH=wasm go build -buildmode=c-shared -o ../../dist/echo-go.wasm .)

ls -la plugins/dist
