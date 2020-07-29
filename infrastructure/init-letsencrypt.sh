#!/bin/bash

sudo apt-get install certbot python3-certbot-dns-digitalocean -y

certbot certonly \
  --dns-digitalocean \
  --dns-digitalocean-credentials ~/digitalocean.api.key \
  --dns-digitalocean-propagation-seconds 120 \
  -m "schmelczerandras@gmail.com" \
  -d "decla.red" -d "*.decla.red" \
  --agree-tos

curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "/etc/letsencrypt/options-ssl-nginx.conf"
curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "/etc/letsencrypt/ssl-dhparams.pem"