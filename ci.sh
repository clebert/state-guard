#!/bin/bash
set -e           # Terminates script at the first error
set -o pipefail  # Sets the exit status for pipes
set -u           # Triggers an error when an unset variable is called
set -o noclobber # Prevents from overwriting existing files
npm run compile:emit
npm run compile:check
npm run format:check
npm run lint
npm run size:check
npm test
npm start
