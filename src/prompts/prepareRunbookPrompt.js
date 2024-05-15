/*
 * Welcome to the docker image for our prompts.
 * I can only assume you are here to look at our system prompts.
 * Hopefully they are not too dissappointing for you.
 */
const prepareProjectPrompt = (facts, username, platform) => {
  try {
    facts = JSON.parse(facts);
  } catch (e) {
    throw new Error("Invalid JSON for facts: " + e);
  }

  try {
    platform = JSON.parse(platform);
  } catch (e) {
    throw new Error("Invalid JSON for platform: " + e);
  }

  const dockerfiles = facts["project/dockerfiles"]
    .map(
      (dockerfile) =>
        `Dockerfile at ${dockerfile["path"]} contains:\n${dockerfile["content"]}`
    )
    .join("\n\n");

  const composefiles =
    facts["project/composefiles"].length === 0
      ? "The user is not using docker compose in this project."
      : facts["project/composefiles"]
          .map(
            (composefile) =>
              `Compose file at ${composefile["path"]} contains:\n${composefile["content"]}`
          )
          .join("\n\n");

  const builds = facts["project/builds"]
    .map(
      (build) =>
        `The Docker file ${build["file"]} was built using the context ${build["context"]} and tagged ${build["tag"]}`
    )
    .join("\n\n");

  const projectLanguages = facts["github/linguist"];

  const messages = [
    {
      role: "system",
      content:
        "You are an assistant who specializes in making runbooks for Docker projects, allowing any developer to quickly run a docker project locally for development. Since you are an expert and know about their project, be definitive about recommendations.\n\n\
            The user has a project open which will be described. The user has Docker Desktop installed and therefore has full access to run docker commands. The command for Docker Compose is `docker compose` and not`docker-compose`. \
            When using docker compose, the user should use `docker compose up --build`.",
    },
    {
      role: "system",
      content:
        "The user's current working directory `.` is the root of their project. They want to start this for local development.",
    },
    {
      role: "system",
      content: `The user's platform is: ${platform}`,
    },
    {
      role: "system",
      content:
        "Before you generate a runbook, \
        provide a way to setup env vars. If the project requires env vars or references an env file, mention that. If it doesn't mention env vars, tell the user.",
    },
    {
      role: "system",
      content:
        "After steps to set the environment variables, generate a runbook. A runbook for a Docker project \
        consists of 3 parts: Build, Run, Share. Use regular markdown headings for these sections.\
        The build section describes how to build the project.\
        If the user is using Docker Compose, simply say they do not need to build separately.\
        An image tag should be used if needed.\
        The run section describes how to run the project docker.\
        The share section describes how to share the project\
        such as `docker push repo/imagename`. Do not recommend stopping or removing containers.",
    },
    {
      role: "system",
      content: `The user is logged in to Docker Hub as ${username}`,
    },
    { role: "system", content: "--START PROJECT INFORMATION--" },
    {
      role: "system",
      content: `The project has the following Dockerfiles:\n${dockerfiles}`,
    },
    {
      role: "system",
      content: `The project structure looks like:\n\n${JSON.stringify(
        projectLanguages
      )}`,
    },
    {
      role: "system",
      content: `The project has the following Docker Compose files:\n${composefiles}`,
    },
    {
      role: "system",
      content: `The user has built this project recently using the following:\n${builds}`,
    },
    {
      role: "system",
      content: "--END PROJECT INFORMATION--",
    },
    {
      role: "system",
      content:
        "Format runnable sections as code blocks. \
        For example, use triple backticks to format code blocks in markdown.\
        Use ```sh for UNIX shell commands and ```powershell for PowerShell commands.",
    },
  ];

  // Combine all messages as one system prompt
  return [
    {
      role: "system",
      content: messages.map((message) => message.content).join("\n\n"),
    },
  ];
};

// Warn about missing args
if (process.argv.length < 4) {
  console.error(
    "Usage: node prepareRunbookPrompt.js <facts json> <username string> <platform json>"
  );
  process.exit(1);
}

// Facts, Username, Platform
const messages = prepareProjectPrompt(
  process.argv[2],
  process.argv[3],
  process.argv[4]
);

// Print messages JSON
console.log(JSON.stringify(messages));
