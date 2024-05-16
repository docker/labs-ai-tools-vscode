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

TODO - document how prompts can use our project facts

