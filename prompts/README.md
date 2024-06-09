
## Running

To generate prompts for a project, run the following command, clone a repo into `$PWD` and run the 
following command.

```sh
docker run --rm \
           -v /var/run/docker.sock:/var/run/docker.sock \
           --mount type=volume,source=docker-prompts,target=/prompts \
           vonwig/prompts:local $PWD \
                                jimclark106 \
                                darwin \
                                "github:docker/labs-make-runbook?ref=main&path=prompts/lazy_docker"
```

The four arguments are `project root dir`, `docker username`, `platform`, and the `github ref` for versioned prompt files.

If you need to test prompts locally, you can open a terminal in your prompts directory and then type the following command
to test them.

```sh
docker run --rm \
           -v /var/run/docker.sock:/var/run/docker.sock \
           -v $PWD:/app/my_prompts \
           --workdir /app
           vonwig/prompts:local $PWD \
                                jimclark106 \
                                darwin \
                                my_prompts
```

### GitHub refs

Prompts are fetched from a GitHub repository.  The mandatory parts of the ref are `github:{owner}/{repo}` 
but optional `path` and `ref` can be added to pull prompts from branches, and to specify a subdirectory
where the prompt files are located in the repo.

### Prompt file layout

Each prompt directory should contain a README.md describing the prompts and their purpose.  Each prompt file
is a markdown document that supports moustache templates for subsituting context extracted from the project.

```
prompt_dir/
├── 010_system_prompt.md
├── 020_user_prompt.md
└── README.md
```

* ordering of messages is determined by filename sorting
* the role is encoded in the name of the file

### Moustache Templates

The prompt templates can contain expressions like {{dockerfiles}} to add information
extracted from the current project.  Examples of facts that can be added to the
prompts are:

* `{{platform}}` - the platform of the current development environment.
* `{{username}}` - the DockerHub username (and default namespace for image pushes)
* `{{languages}}` - names of languages discovered in the project.
* `{{project.dockerfiles}}` - the relative paths to local DockerFiles
* `{{project.composefiles}}` - the relative paths to local Docker Compose files.

The entire `project-facts` map is also available using dot-syntax
forms like `{{project-facts.project-root-uri}}`.  All moustache template
expressions documented [here](https://github.com/yogthos/Selmer) are supported.

## Building

```sh
#docker:command=builds
docker build -t vonwig/prompts:local -f Dockerfile .
```

