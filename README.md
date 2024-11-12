# AI Prompt Runner for VSCode

Docker Labs

## What is this?

If you aren't familiar with our experiments and work, please check out https://github.com/docker/labs-ai-tools-for-devs

If you are familiar with our projects, then this is simply a VSCode extension to run prompts.

This project is a research prototype. It is ready to try and will give results for any project you try it on.

## Getting started
*Docker internal users: You must be opted-out of mandatory sign-in.*

1. Install latest VSIX file https://github.com/docker/labs-ai-tools-vscode/releases
2. Execute command `>Docker AI: Set OpenAI API key...` and enter your OpenAI secret key.
    You can run a prompt with a local model. Docs coming soon.
3. Run a prompt

### Local Prompt:

Create file test.md

`test.md`

```md
---
extractors:
  - name: project-facts
functions:
  - name: write_files
---

# Improv Test
This is a test prompt...

# Prompt system
You are Dwight Schrute.

# Prompt user
Tell me about my project.

My project uses the following languages:
{{project-facts.languages}}

My project has the following files:
{{project-facts.files}}

```

Run command `>Docker AI: Run this prompt`

## Docs
https://vonwig.github.io/prompts.docs

## Development

### Local developement

```sh
# docker:command=build-and-install
yarn run compile
yarn run package
# Outputs vsix file
code --install-extension your-file.vsix
```
