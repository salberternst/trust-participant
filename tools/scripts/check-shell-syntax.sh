#!/usr/bin/env bash
set -euo pipefail

status=0

for file in "$@"; do
  if [[ ! -f "$file" ]]; then
    continue
  fi

  first_line=""
  IFS= read -r first_line <"$file" || true

  if [[ "$first_line" == *bash* ]]; then
    checker=(bash -n)
  else
    checker=(sh -n)
  fi

  if ! "${checker[@]}" "$file"; then
    status=1
  fi
done

exit "$status"
