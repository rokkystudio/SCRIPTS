# BLOCK_GEO_RU

## Назначение

Этот документ описывает безопасную схему geo-block для Debian-сервера, где ограничение нужно только для **новых исходящих** соединений отдельных процессов, а не для всей машины целиком.

Схема использует только `nftables`.

`ufw` вместе с этим конфигом не используется.

Блокировка применяется только к назначениям из российских IPv4/IPv6 диапазонов через наборы `ru4` и `ru6`.

Что даёт эта схема:

- выбранные процессы не могут открывать новые исходящие соединения к RU IP;
- остальная исходящая сеть сервера продолжает работать;
- входящие подключения не режутся этим конфигом, потому что здесь нет `INPUT/FORWARD policy drop`;
- правила можно быстро выключить и быстро включить без удаления файлов.

---

## Для каких сервисов подходит

В примере ниже используются процессы:

- `xray`
- `caddy`

UID не зашиваются вручную. Они определяются на сервере автоматически через:

```bash
id -u xray
id -u caddy
```

За счёт этого набор команд подходит не только для одной конкретной машины, а для любой системы, где эти пользователи существуют.

Если на сервере используются другие сервисные пользователи, правила нужно строить для их UID по той же схеме.

---

## Почему прежняя схема ломала сеть

Проблема возникает при одновременном использовании двух управляющих слоёв над netfilter:

- `ufw` / `iptables`
- `nftables`

На Debian они могут одновременно влиять на один и тот же backend. В таком режиме правила из `ufw` и правила из `nftables` живут параллельно, и удаление только одной таблицы не гарантирует восстановление сети.

Безопасная схема для этого кейса:

- `ufw` полностью удалить;
- использовать только `nftables`;
- не делать `policy drop` на `INPUT`;
- не делать `policy drop` на `FORWARD`;
- не ставить timer/service для автообновления списков;
- скачать RU списки один раз и дальше хранить локальный snapshot.

---

## Важное предупреждение для Xray REALITY VLESS

При включённой блокировке российского сегмента сети нельзя выбирать для `Xray REALITY VLESS` значение `server_name` / `target` / `serverNames`, которое резолвится в RU IP.

Если `xray` для работы REALITY должен открыть новое исходящее соединение к RU IP, это соединение будет отклонено правилами `nftables`.

Практический вывод:

- `server_name` должен быть не из RU сегмента;
- `target` должен быть не из RU сегмента;
- `serverNames` должны быть не из RU сегмента.

После смены `target` на сервере нужно одновременно поменять и клиентский `server_name`.

---

## Файлы

Итоговая схема использует только эти файлы:

- `/etc/nftables.conf`
- `/etc/nftables.d/geo-vpn.nft`
- `/var/lib/nftables/geo-vpn/sets.nft`
- `/root/build-geo-ru-nft.sh`

Никаких timer/service для автообновления не используется.

---

## 1) Подготовка сервера и очистка от старых правил

Этот блок:

- устанавливает нужные пакеты;
- выключает и удаляет `ufw`;
- выключает и удаляет старые `update-ru-nftsets.*`;
- удаляет старые geo-block файлы;
- очищает активные `iptables`/`ip6tables`;
- очищает активный ruleset `nftables`;
- подготавливает систему к одной схеме через `nftables`.

```bash
apt-get update
apt-get install -y nftables curl ca-certificates

systemctl disable --now ufw 2>/dev/null || true
apt-get purge -y ufw || true
apt-get autoremove -y || true

systemctl disable --now update-ru-nftsets.timer update-ru-nftsets.service 2>/dev/null || true
rm -f /etc/systemd/system/update-ru-nftsets.service
rm -f /etc/systemd/system/update-ru-nftsets.timer
rm -f /usr/local/sbin/update-ru-nftsets.sh

rm -f /etc/nftables.d/geo-vpn.nft
rm -rf /var/lib/nftables/geo-vpn
rm -f /root/build-geo-ru-nft.sh

iptables -P INPUT ACCEPT
iptables -P FORWARD ACCEPT
iptables -P OUTPUT ACCEPT
ip6tables -P INPUT ACCEPT
ip6tables -P FORWARD ACCEPT
ip6tables -P OUTPUT ACCEPT

iptables -F
iptables -X
ip6tables -F
ip6tables -X

nft flush ruleset

mkdir -p /etc/nftables.d
mkdir -p /var/lib/nftables/geo-vpn
rm -f /etc/nftables.d/geo-vpn.nft
```

Проверка после подготовки:

```bash
iptables -S
ip6tables -S
nft list tables
systemctl is-enabled ufw 2>/dev/null || true
```

Ожидаемо:

- у `iptables` и `ip6tables` политика `ACCEPT`;
- `ufw` отсутствует или disabled;
- в `nft list tables` нет старой `geo_vpn`.

---

## 2) Одноразовая загрузка RU списков

Ниже используется отдельный скрипт одноразовой сборки локального snapshot.

Свойства этой схемы:

- загрузка только вручную по явному запуску;
- только HTTPS;
- только временная директория через `mktemp -d`;
- итоговый файл заменяется через `install`;
- никаких timer/service;
- никаких фоновых обновлений.

В этой версии генерация `sets.nft` сделана без `awk`-шаблонов и без сложной валидации, чтобы уменьшить риск поломки при запуске.

```bash
cat >/root/build-geo-ru-nft.sh <<'EOF'
#!/bin/sh
set -eu

STATE_DIR=/var/lib/nftables/geo-vpn
TMP_DIR="$(mktemp -d)"

cleanup() {
    rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

mkdir -p "$STATE_DIR"

curl --proto '=https' --tlsv1.2 -fsSL https://www.ipdeny.com/ipblocks/data/aggregated/ru-aggregated.zone -o "$TMP_DIR/ru4.zone"
curl --proto '=https' --tlsv1.2 -fsSL https://www.ipdeny.com/ipv6/ipaddresses/aggregated/ru-aggregated.zone -o "$TMP_DIR/ru6.zone"

sed '/^$/d;s/\r$//' "$TMP_DIR/ru4.zone" | grep -E '^[0-9.]+/[0-9]+$' > "$TMP_DIR/ru4.clean"
sed '/^$/d;s/\r$//' "$TMP_DIR/ru6.zone" | grep -E '^[0-9A-Fa-f:]+/[0-9]+$' > "$TMP_DIR/ru6.clean"

[ -s "$TMP_DIR/ru4.clean" ]
[ -s "$TMP_DIR/ru6.clean" ]

{
    echo 'set ru4 {'
    echo '    type ipv4_addr'
    echo '    flags interval'
    echo '    auto-merge'
    echo '    elements = {'
    sed 's/^/        /;$!s/$/,/' "$TMP_DIR/ru4.clean"
    echo '    }'
    echo '}'
    echo
    echo 'set ru6 {'
    echo '    type ipv6_addr'
    echo '    flags interval'
    echo '    auto-merge'
    echo '    elements = {'
    sed 's/^/        /;$!s/$/,/' "$TMP_DIR/ru6.clean"
    echo '    }'
    echo '}'
} > "$TMP_DIR/sets.nft"

install -m 0644 "$TMP_DIR/sets.nft" "$STATE_DIR/sets.nft"
EOF

chmod 0700 /root/build-geo-ru-nft.sh
/root/build-geo-ru-nft.sh
```

Проверка локального snapshot:

```bash
sed -n '1,40p' /var/lib/nftables/geo-vpn/sets.nft
```

Примечание:

- после этого на сервере лежит локальный snapshot RU сетей;
- этот snapshot сам не меняется;
- обновление не происходит, пока администратор сам не запустит `/root/build-geo-ru-nft.sh`;
- если обновления не нужны совсем, скрипт можно удалить после успешной сборки.

Удаление скрипта после одноразовой сборки:

```bash
rm -f /root/build-geo-ru-nft.sh
```

---

## 3) Создание конфига `nftables`

Перед созданием правил нужно убедиться, что на сервере существуют пользователи `xray` и `caddy`.

Проверка:

```bash
id xray
id caddy
```

Конфиг ниже:

- использует только `output` hook;
- имеет `policy accept`;
- не управляет `INPUT`;
- не управляет `FORWARD`;
- не создаёт глобальный deny для сервера;
- определяет UID `xray` и `caddy` на сервере автоматически;
- применяет reject только к нужным UID и только к новым исходящим подключениям на RU IP.

```bash
XRAY_UID="$(id -u xray)"
CADDY_UID="$(id -u caddy)"

cat >/etc/nftables.d/geo-vpn.nft <<EOF
table inet geo_vpn {
    include "/var/lib/nftables/geo-vpn/sets.nft"

    chain output {
        type filter hook output priority filter; policy accept;

        ct state established,related accept

        meta skuid $XRAY_UID ct direction original ip daddr @ru4 ct state new reject with icmpx admin-prohibited
        meta skuid $XRAY_UID ct direction original ip6 daddr @ru6 ct state new reject with icmpx admin-prohibited

        meta skuid $CADDY_UID ct direction original ip daddr @ru4 ct state new reject with icmpx admin-prohibited
        meta skuid $CADDY_UID ct direction original ip6 daddr @ru6 ct state new reject with icmpx admin-prohibited
    }
}
EOF

cat >/etc/nftables.conf <<'EOF'
#!/usr/sbin/nft -f
flush ruleset
include "/etc/nftables.d/geo-vpn.nft"
EOF
```

---

## 4) Проверка конфига и включение правил

Этот блок проверяет синтаксис и загружает конфиг только после успешной проверки.

```bash
nft -c -f /etc/nftables.conf
nft -f /etc/nftables.conf
systemctl enable --now nftables
```

Проверка:

```bash
systemctl is-enabled nftables
systemctl is-active nftables
nft list chain inet geo_vpn output
```

Дополнительная проверка сети сервера:

```bash
ping -c2 1.1.1.1
ping -c2 google.com
```

Если эти команды работают, базовая сеть сервера не сломана.

---

## 5) Быстрое выключение правил

Этот вариант ничего не удаляет на диске и не меняет конфиг. Он только убирает активную таблицу из ядра.

```bash
nft delete table inet geo_vpn
```

Проверка:

```bash
nft list tables
```

Если `table inet geo_vpn` не выводится, правила выключены.

Примечание:

- этот режим не удаляет `/etc/nftables.conf`;
- этот режим не удаляет `/etc/nftables.d/geo-vpn.nft`;
- этот режим не удаляет `/var/lib/nftables/geo-vpn/sets.nft`;
- после `systemctl restart nftables` правила снова включаются из сохранённого конфига.

---

## 6) Быстрое включение правил

Этот вариант заново загружает сохранённый конфиг в `nftables`.

```bash
nft -c -f /etc/nftables.conf
nft -f /etc/nftables.conf
```

Проверка:

```bash
nft list chain inet geo_vpn output
```

---

## 7) Полное удаление geo-block

Этот блок:

- выключает `nftables`;
- удаляет geo-block файлы;
- возвращает пустой конфиг `nftables`;
- оставляет сервер без geo-block.

```bash
systemctl disable --now nftables
nft flush ruleset

rm -f /etc/nftables.d/geo-vpn.nft
rm -rf /var/lib/nftables/geo-vpn
rm -f /root/build-geo-ru-nft.sh

cat >/etc/nftables.conf <<'EOF'
#!/usr/sbin/nft -f
flush ruleset
EOF
```

Проверка:

```bash
systemctl is-enabled nftables 2>/dev/null || true
systemctl is-active nftables 2>/dev/null || true
nft list tables
```

---

## 8) Что здесь считается безопасным

Безопасность этой схемы для данного сервера обеспечивается следующими свойствами:

- нет `ufw`;
- нет параллельного управления через `iptables` и отдельные конфиги `nftables`;
- нет `INPUT policy drop`;
- нет `FORWARD policy drop`;
- нет таймеров и фоновых обновлений списков;
- есть только локальный snapshot RU IP, скачанный один раз;
- есть только `output policy accept`;
- есть только точечные `reject` правила для нужных сервисных UID.

Это делает поведение конфига предсказуемым: сервер продолжает жить как обычная машина, а ограничения действуют только на новые исходящие соединения нужных процессов к RU IP.

---

## 9) Команды быстрой диагностики

```bash
id xray
id caddy
iptables -S
ip6tables -S
nft list tables
nft list ruleset
systemctl status nftables --no-pager
ping -c2 1.1.1.1
ping -c2 google.com
```

Если снова пропадёт доступ, сначала проверь:

- не установлен ли заново `ufw`;
- не появились ли `INPUT/FORWARD DROP`;
- не загружен ли другой `nftables` конфиг кроме этого.

---

## 10) Подводные камни и рекомендации

- Вставка длинных команд через VNC может повреждать текст. Если консоль ведёт себя нестабильно, лучше сначала собрать файл через heredoc, а потом запускать уже готовый файл.
- Если `/var/lib/nftables/geo-vpn/sets.nft` получился неполным, `nft -c -f /etc/nftables.conf` упадёт на синтаксисе include-файла.
- Если на сервере нет пользователя `xray` или `caddy`, команда `id -u ...` завершится ошибкой. В этом случае сначала нужно убедиться, что сервис установлен и его системный пользователь существует.
- Если одноразовый snapshot RU IP со временем устареет, его можно пересобрать вручную повторным запуском `/root/build-geo-ru-nft.sh` до удаления этого скрипта.
- Для `Xray REALITY VLESS` нельзя использовать `target` и `server_name`, которые уходят в RU IP, иначе geo-block будет мешать работе самого `xray`.
