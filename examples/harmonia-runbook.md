## Install Harmonia

If I want to check the version

```sh
docker harmonia version
```

### Create Engine

Engine names be all lower-case but can contain hyphens.
Note that I don't have to install any nvidia toolkit here!

```sh
docker harmonia engine create eye-in-the-sky --type aiml-amd64
```

```sh
docker context use eye-in-the-sky
```

### List engines

```sh
docker harmonia engine ls
```

Remember that a harmonia engine is also a docker context so you'll see it displayed as a context too.
This is the super powerful part.  You might use harmonia to create your engine.  But then it's just
regular Docker.

```sh
docker context ls
```

### Start the Ollama engine remotely

```sh
# docker:command=start-ollama
docker network inspect ollama > /dev/null || docker network create ollama
docker run --name ollama-in-the-sky \
           --rm \
           --gpus all \
           -p 11434:11434 \
           --network ollama \
           -d \
           --mount type=volume,source=models,target=/root/.ollama/models \
           ollama/ollama
```

Is it running?

```sh
docker ps
```

```sh
docker network inspect ollama
```

### Stopping the remote container

```sh
#docker:command=kill-ollama

docker container kill ollama-in-the-sky
```

### Pulling an LLM into the remote container

I can now use `ollama ls` to see what LLMs have been pulled.  There should be none.

```sh
docker run --rm -e OLLAMA_HOST=ollama-in-the-sky:11434 --network ollama ollama/ollama ls 
```

Now, let's pull llama3 on to the host machine, making sure that it's on a volume mount so that
if the container stops, I don't have to pull it again.

```sh
docker run --rm -e OLLAMA_HOST=ollama-in-the-sky:11434 --network ollama ollama/ollama pull llama3
```

### Debugging 

This didn't work when the container was running in harmonia.

```sh
docker debug ollama-in-the-sky
```

I can still use exec though.  For example, here's where I'm storing the LLM models remotely.

```sh
docker exec -it ollama-in-the-sky ls /root/.ollama/models
```

### Running

We could run the client locally, but let's just run it in the harmonia engine, where the server is.

```sh
docker run -it --rm -e OLLAMA_HOST=ollama-in-the-sky:11434 --network ollama ollama/ollama run llama3
```

### Remove the engine

Once we're done, we can clean up the pod but once the whole engine is removed, remember that the pulled
llm models will be gone too.

```sh
docker harmonia engine rm eye-in-the-sky
```

