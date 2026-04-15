# README

## Текущее состояние

На сервере включён geo-block для исходящих **новых** соединений (`ct state new`) только для процессов:

- `xray` — UID `996`
- `caddy` — UID `999`

Блокируются назначения из российских IPv4/IPv6 диапазонов через наборы `ru4` и `ru6`.

Что это даёт:

- VLESS + REALITY, запущенный от `xray`, не может открывать новые соединения к RU IP.
- NaïveProxy, запущенный внутри `caddy`, не может открывать новые соединения к RU IP.
- SSH и обычные входящие подключения к серверу не ломаются, потому что разрешены ответы по уже установленным соединениям через `ct state established,related accept`.

Файлы и сервисы:

- `/etc/nftables.conf`
- `/etc/nftables.d/geo-vpn.nft`
- `/var/lib/nftables/geo-vpn/sets.nft`
- `/usr/local/sbin/update-ru-nftsets.sh`
- `update-ru-nftsets.service`
- `update-ru-nftsets.timer`

Текущие правила:

```nft
meta skuid 996 ip daddr @ru4 ct state new reject with icmpx admin-prohibited
meta skuid 996 ip6 daddr @ru6 ct state new reject with icmpx admin-prohibited
meta skuid 999 ip daddr @ru4 ct state new reject with icmpx admin-prohibited
meta skuid 999 ip6 daddr @ru6 ct state new reject with icmpx admin-prohibited
```

Проверка текущего состояния:

```bash
id xray
id caddy
systemctl is-enabled nftables
systemctl is-active nftables
systemctl is-active update-ru-nftsets.timer
nft list chain inet geo_vpn output
systemctl list-timers --all --no-pager | grep update-ru-nftsets
```

---

## 1) Установка фильтров с чистой системы, на которой уже стоят прокси

Важно: ниже используются текущие UID из этой конфигурации:

- `xray` = `996`
- `caddy` = `999`

Перед запуском проверь их на своей системе:

```bash
id xray
id caddy
```

### Установка

```bash
apt-get update
apt-get install -y nftables curl ca-certificates

mkdir -p /etc/nftables.d
mkdir -p /usr/local/sbin
mkdir -p /var/lib/nftables/geo-vpn
mkdir -p /etc/systemd/system

cp -a /etc/nftables.conf /etc/nftables.conf.bak.$(date +%F-%H%M%S) 2>/dev/null || true

cat >/etc/nftables.d/geo-vpn.nft <<'EOF'
table inet geo_vpn {
    include "/var/lib/nftables/geo-vpn/sets.nft"

    chain output {
        type filter hook output priority filter; policy accept;

        ct state established,related accept

        meta skuid 996 ip daddr @ru4 ct state new reject with icmpx admin-prohibited
        meta skuid 996 ip6 daddr @ru6 ct state new reject with icmpx admin-prohibited

        meta skuid 999 ip daddr @ru4 ct state new reject with icmpx admin-prohibited
        meta skuid 999 ip6 daddr @ru6 ct state new reject with icmpx admin-prohibited
    }
}
EOF

cat >/usr/local/sbin/update-ru-nftsets.sh <<'EOF'
#!/bin/sh
set -eu

STATE_DIR=/var/lib/nftables/geo-vpn
TMP_DIR="$(mktemp -d)"

cleanup() {
    rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

mkdir -p "$STATE_DIR"

curl -fsSL https://www.ipdeny.com/ipblocks/data/aggregated/ru-aggregated.zone -o "$TMP_DIR/ru4.zone"
curl -fsSL https://www.ipdeny.com/ipv6/ipaddresses/aggregated/ru-aggregated.zone -o "$TMP_DIR/ru6.zone"

gen_elements() {
    awk '
        NF {
            sub(/\r$/, "")
            if (n++) {
                printf(",\n")
            }
            printf("        %s", $0)
        }
        END {
            printf("\n")
        }
    ' "$1"
}

cat >"$TMP_DIR/sets.nft" <<SETS
set ru4 {
    type ipv4_addr
    flags interval
    auto-merge
    elements = {
$(gen_elements "$TMP_DIR/ru4.zone")
    }
}

set ru6 {
    type ipv6_addr
    flags interval
    auto-merge
    elements = {
$(gen_elements "$TMP_DIR/ru6.zone")
    }
}
SETS

install -m 0644 "$TMP_DIR/sets.nft" "$STATE_DIR/sets.nft"
nft -c -f /etc/nftables.conf
nft -f /etc/nftables.conf
EOF

chmod 0755 /usr/local/sbin/update-ru-nftsets.sh

cat >/etc/systemd/system/update-ru-nftsets.service <<'EOF'
[Unit]
Description=Update RU IPv4/IPv6 nftables sets

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/update-ru-nftsets.sh
EOF

cat >/etc/systemd/system/update-ru-nftsets.timer <<'EOF'
[Unit]
Description=Update RU IPv4/IPv6 nftables sets weekly

[Timer]
OnBootSec=2min
OnUnitActiveSec=7d
Persistent=true

[Install]
WantedBy=timers.target
EOF

cat >/etc/nftables.conf <<'EOF'
#!/usr/sbin/nft -f
flush ruleset
include "/etc/nftables.d/geo-vpn.nft"
EOF

systemctl daemon-reload
/usr/local/sbin/update-ru-nftsets.sh
systemctl enable --now nftables
systemctl enable --now update-ru-nftsets.timer
```

### Проверка после установки

```bash
systemctl is-enabled nftables
systemctl is-active nftables
systemctl is-active update-ru-nftsets.timer
nft list chain inet geo_vpn output
systemctl list-timers --all --no-pager | grep update-ru-nftsets
```

---

## 2) Удаление фильтров с возвратом к предыдущему состоянию системы, без удаления пользователей

Этот набор команд:

- отключает weekly-обновление списков;
- удаляет кастомные файлы geo-block;
- восстанавливает последний backup `/etc/nftables.conf`, если он есть;
- если backup нет, оставляет пустой `nftables` ruleset.

```bash
systemctl disable --now update-ru-nftsets.timer || true
systemctl stop update-ru-nftsets.service || true

rm -f /etc/systemd/system/update-ru-nftsets.service
rm -f /etc/systemd/system/update-ru-nftsets.timer
rm -f /usr/local/sbin/update-ru-nftsets.sh
rm -f /etc/nftables.d/geo-vpn.nft
rm -rf /var/lib/nftables/geo-vpn

BACKUP="$(ls -1t /etc/nftables.conf.bak.* 2>/dev/null | head -n1 || true)"

if [ -n "$BACKUP" ]; then
    cp -f "$BACKUP" /etc/nftables.conf
else
    cat >/etc/nftables.conf <<'EOF'
#!/usr/sbin/nft -f
flush ruleset
EOF
fi

systemctl daemon-reload
nft -c -f /etc/nftables.conf
nft -f /etc/nftables.conf
systemctl restart nftables
```

### Проверка после удаления

```bash
systemctl is-active nftables
systemctl is-enabled update-ru-nftsets.timer || true
nft list tables
```

---

## 3) Быстрое выключение фильтров без отката до чистой системы

Этот вариант ничего не удаляет и не меняет на диске. Он только убирает активную таблицу из ядра. После этого фильтры сразу перестают действовать.

```bash
nft delete table inet geo_vpn
```

### Проверка

```bash
nft list tables
```

Если `table inet geo_vpn` не выводится, фильтры выключены.

Примечание: это быстрое выключение не удаляет файлы конфигурации. После перезагрузки сервера или после `systemctl restart nftables` фильтры снова включатся из сохранённого конфига.

---

## 4) Быстрое включение фильтров после выключения из пункта 3

Этот вариант заново загружает сохранённый конфиг в `nftables`.

```bash
nft -c -f /etc/nftables.conf
nft -f /etc/nftables.conf
```

### Проверка

```bash
nft list chain inet geo_vpn output
```

Ожидаемый вывод:

```nft
table inet geo_vpn {
        chain output {
                type filter hook output priority filter; policy accept;
                ct state established,related accept
                meta skuid 996 ip daddr @ru4 ct state new reject with icmpx admin-prohibited
                meta skuid 996 ip6 daddr @ru6 ct state new reject with icmpx admin-prohibited
                meta skuid 999 ip daddr @ru4 ct state new reject with icmpx admin-prohibited
                meta skuid 999 ip6 daddr @ru6 ct state new reject with icmpx admin-prohibited
        }
}
```
