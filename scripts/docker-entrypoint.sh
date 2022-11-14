#!/bin/bash

set -e

if [ "$1" = 'html2svg' ]; then
    export DISPLAY=:99

    Xvfb $DISPLAY -screen 0 640x480x8 -nolisten tcp &
    /runtime/electron --no-sandbox /app/build/html2svg.js
else
    exec "$@"
fi

