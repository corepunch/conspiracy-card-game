#!/bin/sh
cd "$(dirname "$0")" || exit 1

port=8080
while lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; do
  port=$((port + 1))
  if [ "$port" -gt 8090 ]; then
    printf '\nCould not find a free port between 8080 and 8090.\n'
    printf 'Stop one of the existing local servers and try again.\n\n'
    exit 1
  fi
done

printf '\nThe Hidden Archive is available at http://localhost:%s\n' "$port"
printf 'Keep this window open while playing. Press Control-C to stop.\n\n'
python3 -m http.server "$port"
