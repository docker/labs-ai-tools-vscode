FROM babashka/babashka:latest@sha256:4bc4beea38406782845ae8effaa9bd2f45345d46a4290ea4c96037970a0ca430 AS bb

FROM eclipse-temurin:latest AS deps

WORKDIR /app

COPY --from=bb /usr/local/bin/bb /usr/local/bin/bb
COPY bb.edn bb.edn
COPY ./src ./src
RUN bb uberjar prompts.jar -m prompts

FROM bb

WORKDIR /app

COPY --from=deps /app/prompts.jar /app/prompts.jar

COPY docker docker 
COPY npm_setup npm_setup
COPY lazy_docker lazy_docker
COPY git_hooks git_hooks
COPY harmonia harmonia
COPY ollama ollama

# Can't be shell form because we need to pass JSON as an arg
ENTRYPOINT [ "bb", "prompts.jar" ]
