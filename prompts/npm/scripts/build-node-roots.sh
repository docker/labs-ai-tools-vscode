#!/bin/bash
# Echo JSON with project.node_roots[]

cat payload.json

# Use JQ to get scripts
# jq -r '.project.node_roots[]' payload.json