FROM node:18.19-alpine3.19

WORKDIR /prompts

COPY prepareRunbookPrompt.js prepareRunbookPrompt.js

# Can't be shell form because we need to pass JSON as an arg
ENTRYPOINT [ "node" ]

CMD ["prepareRunbookPrompt.js"]