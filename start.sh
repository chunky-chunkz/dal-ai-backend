#!/bin/bash
 
script_dir=$(dirname "$(realpath "$0")")
script_name=$(basename "$0")
current_dir=$(pwd)
 
if [ "$script_dir" = "$current_dir" ]; then
    npm install -g serve
    npm install
    npm run build
    serve -s -l tcp://127.0.0.1:3021 dist
else
    cd "$script_dir"
    exec "./$script_name"
fi