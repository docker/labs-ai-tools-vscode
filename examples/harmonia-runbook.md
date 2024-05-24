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

docker run --name ollama-in-the-sky \
           --rm \
           --gpus all \
           -p 11434:11434 \
           -d \
           --mount type=volume,source=models,target=/root/.ollama/models \
           ollama/ollama
```

Is it running?

```sh
docker ps
```

### Stopping the remote container

```sh
#docker:command=kill-ollama

docker container kill ollama-in-the-sky
```

### Pulling an LLM into the remote container

This should work but it didn't.  Rodny looking at this.
This was really remote client -> remote server so it should work.

```sh
docker run --rm -e OLLAMA_HOST=127.0.0.1 ollama/ollama ls 
```

This one does work!  This is

* _client_ running in local engine
* _server_ running in remote Harmonia engine

```sh
docker --context default run --rm -e OLLAMA_HOST=host.docker.internal:11434 ollama/ollama ls 
```

So, let's pull llama3 on to the host machine, making sure that it's on a volume mount so that
if the container stops, I don't have to pull it again.

```sh
docker --context default run --rm -e OLLAMA_HOST=host.docker.internal:11434 ollama/ollama pull llama3
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

* local ollama client running in my local engine
* talking to a remote ollama server with llm in harmonia

```sh
docker --context default run -it --rm -e OLLAMA_HOST=host.docker.internal:11434 ollama/ollama run llama3
```

### Remove the engine

```sh
docker harmonia engine rm eye-in-the-sky
```

