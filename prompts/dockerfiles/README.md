---
extractors:
  - image: vonwig/go-linguist:latest
    command:
      - -json
    output-handler: linguist
tool_choice: auto
model: gpt-4
stream: true
functions:
  - name: analyze_project
    description: Analyze a project to determine how it should be built
    type: prompt
    ref: project_type
  - name: write_files
    description: Write a set of files to my project
    parameters:
        type: object
        properties:
          files:
            type: array
            items:
              type: object
              properties:
                path:
                  type: string
                  description: the relative path to the file that should be written
                content:
                  type: string
                  description: the content that should be written to a file
                executable:
                  type: boolean
                  description: whether to make the file executable
    container:
        image: vonwig/function_write_files:latest
---
