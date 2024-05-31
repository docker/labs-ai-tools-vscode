## Building

```sh
#docker:command=build
docker build -t vonwig/prompts -f Dockerfile .
```

```sh
#docker:command=push
docker push vonwig/prompts
```

## Running

To run this project, use Docker run command:

```sh
#docker:command=run
docker run vonwig/prompts "{}" "jimclark106" "darwin" "docker"
```

```sh
#docker:command=run-get-prompts
docker run vonwig/prompts prompts
```

* the first argument is the serialized `application/json` map of projects facts.

## Custom prompts

1.  create an empty directory add some example prompts like the ones [here](./v1).

    Each prompt file is a moustache template.  Ordering of prompts is 
    determined by filename sorting.  Each prompt filename must conform to one of
    `.*_system_.*\.txt`, `.*_user_.*\.txt`, or `.*_assistant_.*\.txt`, depending 
    on the role of the message.

2.  For custom prompts, a project directory can be mounted.

    ```sh
    docker run \
      --mount type=bind,source=$PROMPT_DIR,target=/app/prompts \
      vonwig/prompts \
      {json facts string} {username} {platform} prompts

    ```

    This is useful when developing prompts.

### Moustache Templates

The prompt templates can contain expressions like {{dockerfiles}} to add information
extracted from the current project.  Examples of facts that can be added to the 
prompts are:

* `{{platform}}` - the platform of the current development environment.
* `{{username}}` - the DockerHub username (and default namespace for image pushes)
* `{{dockerfiles}}` - the relative paths to local DockerFiles
* `{{languages}}` - names of languages discovered in the project.
* `{{composefiles}}` - the relative paths to local Docker Compose files.

The entire `project-facts` map is also available using dot-syntax 
forms like `{{project-facts.project-root-uri}}`.  All moustache template 
expressions documented [here](https://github.com/yogthos/Selmer) are supported.

