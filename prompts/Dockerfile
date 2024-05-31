FROM babashka/babashka:latest@sha256:4bc4beea38406782845ae8effaa9bd2f45345d46a4290ea4c96037970a0ca430

WORKDIR /app

COPY prompts.clj prompts.clj
COPY docker docker 
COPY lazy_docker lazy_docker
COPY git_hooks git_hooks
COPY harmonia harmonia
COPY ollama ollama

# Can't be shell form because we need to pass JSON as an arg
ENTRYPOINT [ "bb", "-f", "prompts.clj" ]
