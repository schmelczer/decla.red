#!/bin/sh

set -e

if [ -z "$1" ]; then
  echo "Please specify a domain" 1>&2
  exit 1
fi

domain="$1"

apt install -y curl
curl -sL https://deb.nodesource.com/setup_15.x | bash -
apt update 
apt install -y nodejs nginx certbot python3-certbot-nginx
npm i -g declared-server

certbot certonly --nginx -m schmelczerandras@gmail.com -d "$domain".decla.red --agree-tos --non-interactive

mv nginx.conf /etc/nginx/nginx.conf
sed -i "s/serverName/$domain/g" /etc/nginx/nginx.conf
nginx -s reload

chmod +x /root/declared-servers.sh
chown root:root /root/declared-servers.sh
cp declared-servers.service /etc/systemd/system/declared-servers.service
systemctl enable declared-servers.service
systemctl start declared-servers
