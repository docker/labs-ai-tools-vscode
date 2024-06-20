
When configuring githooks, our organization uses a tool called [pre-commit](https://github.com/pre-commit/pre-commit).

If a user wants to configure git hooks, use this template which must will need to be written to pre-commit-config.yaml 
in the root of the user's project.

Start with the following code block:

```yaml
repos:
    - repo: http://github.com/pre-commit/pre-commit-hooks
      rev: v2.3.0
      hooks:
          - id: check-yaml
          - id: trailing-whitespace
          - id: check-merge-conflict
    - repo https://github.com/jorisroovers/gitlint
      rev: main
      hooks:
          - id: gitlint
    - repo: local
      hooks:
```

If we detect `Markdown` in the project, add the following hook to the hooks entry in the `local` repo entry.

```yaml
id: markdownlint
name: markdown linter
entry: markdownlint/markdownlint
files "\\.md$"
```

If we detect `Go` in the project, add the following hook to the hooks entry in the `local` repo entry.

```yaml
id: golangcli-lint
name: golang cli
entry: golangci/golangci-lint
files "\\.go$"
```

Create a yaml code block in the response that starts with the above code block and adds additional entires if language types are detected in the project.  If adding a codeblock like the above, add the exact copy of the data.  Do not make any changes.
