#!/bin/bash

set -e

export DISPLAY=:99

Xvfb $DISPLAY -screen 0 1920x1080x24 &
/runtime/electron --no-sandbox /app/build/html2svg.cli.js "$@"
