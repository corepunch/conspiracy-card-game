#!/bin/sh
cd "$(dirname "$0")" || exit 1
printf '\nThe Hidden Archive is available at http://localhost:8080\n'
printf 'Keep this window open while playing. Press Control-C to stop.\n\n'
python3 -m http.server 8080
