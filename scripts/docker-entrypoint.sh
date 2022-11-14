#!/bin/bash

set -e

export DISPLAY=:99

Xvfb $DISPLAY -screen 0 640x480x8 -nolisten tcp &
/runtime/electron --no-sandbox /app/build/html2svg.js "$@"

