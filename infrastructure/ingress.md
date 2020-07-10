# How to configure ingress from digital ocean docker one-click app

## iptables (remote)

```sh
iptables -L ufw-user-input
iptables -D ufw-user-input 4
iptables -D ufw-user-input 4
iptables -I ufw-user-input -p tcp --dport 80 -j ACCEPT
iptables -I ufw-user-input -p tcp --dport 443 -j ACCEPT
```
> Disable Docker ports and enable HTTP(S) ports

## Other (remote)

```sh
apt update && apt upgrade -y
rm -rf /etc/update-motd.d/99-one-click
```

## Copy (local)

```sh
scp -r infrastructure root@164.90.220.12:/root/infra
```