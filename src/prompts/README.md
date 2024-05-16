## Building

```sh
#docker:command=build
docker build -t vonwig/prompts -f Dockerfile .
```

## Running

To run this project, use Docker run command:

```sh
#docker:command=run
docker run vonwig/prompts "{...}" "jimclark106" "darwin"
```

* the first argument is the serialized `application/json` map of projects facts.

## Custom prompts

1.  create a directory like the example `v1` directory in your folder.

    ```
    labs-make-runbook/src/prompts ❯ ls v1
    010_user_prompt.txt    010_system_prompt.txt
    ```

    Each prompt file is a moustache template.  Ordering of prompts is 
    determined by filename sorting.  Each prompt must be either `user` 
    or `system`.

2.  The prompt directory must be mounted when the prompts container runs.

    ```sh
    docker run \
      --mount type=bind,source=$PROMPT_DIR,target=/app/prompts \
      vonwig/prompts \
      {json facts string} {username} {platform} prompts

    ```

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

