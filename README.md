# Docker AI Prompts



## What is this project?


## Getting started
Docker internal users: You must be opted-out of mandatory sign-in.

1. Install latest VSIX file https://github.com/docker/labs-make-runbook/releases
2. Open your workspace
3. Execute command `>Set OpenAI API key...` and enter your OpenAI secret key.
4. Execute command `>save-prompt` and enter your prompt URL/ref.
    Example prompt: `https://github.com/docker/labs-ai-tools-for-devs/tree/main/prompts/poem`
5. Execute command `>run-prompt`

This project is a research prototype. It is ready to try and will give results for any project you try it on.

## Development

### Local developement

```sh
# docker:command=build-and-install
yarn run compile
yarn run package
# Outputs vsix file
code --install-extension your-file.vsix
```
