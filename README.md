# Docker Runbook Generator

The Docker Runbook Generator is a standalone VSCode extension to add additional runbook features on top of the experimental [Docker-VScode](https://github.com/docker/docker-vscode/) extension. 

## What is this project?

"Make Runbook" uses generative AI and project analysis to generate a Docker specific runbook-style `README.md` to your project. 

See the following for an example:

![runbook demo video](https://github.com/docker/docker-vscode/assets/5000430/6da2c934-35f7-470d-962e-a2c9a43a335b)

## Getting started

**Dependency:**
[Docker-VSCode](https://github.com/docker/docker-vscode) alpha version [(installation instructions)](https://github.com/docker/docker-vscode/tree/main/lsp)

1. Install latest VSIX file https://github.com/docker/labs-make-runbook/releases
2. Open Workspace
3. Execute command `>Generate a runbook for this project`

This project is a research prototype. It is ready to try and will give results for any project you try it on.

We are still actively working on the prompt engineering.