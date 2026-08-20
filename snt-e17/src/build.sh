#!/bin/sh
set -e
{ cat head.html
  echo '<script>'
  printf 'const P='
  cat dash.json
  echo ';'
  cat app.js
  echo '</script>'
} > SNT-Gantt.html
