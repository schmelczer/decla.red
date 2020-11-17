# Setup a decla.red server on a fresh debian/ubuntu machine

> The method was tested on Debian 10 DigitalOcean droplets.

- Copy the files from this directory to the target machine.
- Execute the following commands.
- ```sh
  chmod +x setup.sh
  ./setup.sh serverX
  ```

  > Where `serverX` is the serverX.decla.red subdomain pointing to the server.

- Optionally, change the arguments in [declared-servers.sh](declared-servers.sh).
