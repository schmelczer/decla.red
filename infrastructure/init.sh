#!/bin/bash

echo Configuring iptables
echo Start state
iptables -L ufw-user-input

iptables -D ufw-user-input 4
iptables -D ufw-user-input 4
iptables -I ufw-user-input -p tcp --dport 22 -j ACCEPT
iptables -I ufw-user-input -p tcp --dport 80 -j ACCEPT
iptables -I ufw-user-input -p tcp --dport 443 -j ACCEPT

echo End state
iptables -L ufw-user-input

echo Updating system
apt update              &&\
apt upgrade -y          &&\
apt install zsh         &&\
sh -c "$(CHSH=yes curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

docker login -u $DOCKER_TOKEN -p $DOCKER_TOKEN registry.digitalocean.com/declared

echo Removing banner
rm -rf /etc/update-motd.d/99-one-click

docker swarm init --advertise-addr eth0

./init-letsencrypt.sh
curl https://raw.githubusercontent.com/jesseduffield/lazydocker/master/scripts/install_update_linux.sh | bash
docker-compose down
