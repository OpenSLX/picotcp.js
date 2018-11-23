#!/bin/sh
set -eu

cd -- "$(dirname -- "$0")"

# Docker image as referenced in
# <https://kripken.github.io/emscripten-site/docs/compiling/Travis.html>.
docker run --rm -v $(pwd)/tmp:/tmp -v $(pwd):/src trzeci/emscripten emmake make picotcp "$@"
