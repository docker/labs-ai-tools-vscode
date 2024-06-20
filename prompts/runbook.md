# Running prompts

## Running the docker prompts

```sh
#docker:command=run-docker
bb -m prompts /Users/slim/docker/lsp jimclark106 darwin docker
```

## Running the git_hooks prompts

```sh
bb uberjar prompts.jar -m prompts
bb -m prompts run /Users/slim/docker/lsp jimclark106 darwin git_hooks_pre
```

```sh
#docker:command=run-githooks-pre

docker run --rm \
           -it \
           -v /var/run/docker.sock:/var/run/docker.sock \
           --mount type=bind,source=/Users/slim/docker/labs-make-runbook/prompts,target=/app \
           --env "OPENAI_API_KEY=$(cat /Users/slim/.openai-api-key)" \
           --workdir /app \
           vonwig/prompts:local \
                                run \
                                /Users/slim/docker/lsp \
                                jimclark106 \
                                darwin \
                                git_hooks_pre 
```

```sh
#docker:command=run-githooks
bb -m prompts run /Users/slim/docker/lsp jimclark106 darwin git_hooks
```

```sh
#docker:command=run-githooks-single-step
bb -m prompts run /Users/slim/docker/lsp jimclark106 darwin git_hooks_single_step
```

