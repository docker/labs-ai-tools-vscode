## Install Harmonia

If I want to check the version

```sh
docker harmonia version
```

### Create Engine

Engine names be all lower-case but can contain hyphens.
Note that I don't have to install any nvidia toolkit here!

```sh
docker harmonia engine create eye-in-the-sky
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

### Start a dood

Make sure that our cli is using the harmonia context.

```sh
# docker:command=harmonia-context
docker context use eye-in-the-sky
```

Now start the dood cli.

```sh
# docker:command=start-dood

docker run --name docker-cli \
           --rm \
           -it \
           -v /var/run/docker.sock:/var/run/docker.sock \
           docker:cli
```

We should now have a shell and if we check the harmonia engine, there'll be one instance running.

```sh
docker ps
```

We can't do anymore in this runbook because we're attatched to a local kernel.  The dood client is running in a remote pod.  From within that
terminal, run `docker run -it --rm bash` and then come back and re-run the above command.  You should see two processes.

### Remove the engine

Once we're done, we can clean up the pod but once the whole engine is removed, remember that the pulled
llm models will be gone too.

```sh
docker harmonia engine rm eye-in-the-sky
```

