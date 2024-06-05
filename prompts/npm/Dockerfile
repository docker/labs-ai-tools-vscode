FROM ubuntu:20.04

WORKDIR /app

RUN <<EOF
cat > /app/run.sh <<'EOF2'
#!/bin/bash

echo '{"project": {"node_roots": [{"path": "package.json", "content": "some stuff"}]}}'
EOF2
chmod 755 /app/run.sh
EOF

# when the container is running the project is mounted at /project read-only
ENTRYPOINT ["/app/run.sh"]
