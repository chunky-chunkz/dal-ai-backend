#!/bin/bash
 
script_dir=$(dirname "$(realpath "$0")")
script_name=$(basename "$0")
current_dir=$(pwd)
 
if [ "$script_dir" = "$current_dir" ]; then
    npm install
    npm run build
    node dist/server.js
else
    cd "$script_dir"
    exec "./$script_name"
fi