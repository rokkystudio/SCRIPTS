# DNSTT_TUNNEL_VPS

## Назначение

Этот документ описывает установку и настройку серверной части DNSTT на VPS с Debian, включая временную схему с `BIND9` для получения домена в `eu.org` и последующее переключение на `dnstt-server`.

Документ ориентирован на такой сценарий:

- сервер: Debian 12;
- IPv4: `123.123.123.123`;
- основной веб-домен: `example.duckdns.org`;
- отдельный домен под туннель: `t.us.eu.org`;
- backend для DNSTT: `127.0.0.1:22`.

## Что потребуется

1. VPS с root-доступом.
2. Свободный `UDP/53`.
3. Отдельный домен под туннель, в котором можно сделать `NS`-делегацию.
4. Установленный `openssh-server`.
5. `golang`, `git`, `bind9`.

## Важные замечания перед установкой

### DuckDNS остаётся отдельным доменом

Текущий `duckdns`-домен и сертификат Let's Encrypt для него не мешают схеме DNSTT, если новый домен `*.us.eu.org` используется только под туннель.

### Один домен под туннель — это нормально

Если домен `t.us.eu.org` нужен только для DNSTT, это упрощает настройку. После одобрения домена можно полностью освободить `BIND9` и передать `UDP/53` серверу DNSTT.

### До одобрения домена `named` выключать нельзя

Пока заявка в `eu.org` не подтверждена, authoritative DNS должен отвечать корректно на `SOA`, `NS` и `A` для `ns1.t.us.eu.org`.

## Этап 1. Подготовка сервера

### Проверка SSH

```bash
systemctl enable --now ssh
systemctl status ssh --no-pager
ss -ltnp | grep ':22'
```

### Проверка порта 53

```bash
ss -lunp | grep ':53'
```

Если вывод пустой, `UDP/53` свободен.

## Этап 2. Установка зависимостей

```bash
apt update
apt install -y golang git openssh-server bind9 bind9-utils dnsutils
```

## Этап 3. Сборка DNSTT

```bash
cd /opt
git clone https://www.bamsoftware.com/git/dnstt.git
cd /opt/dnstt/dnstt-server
go build

install -m 0755 ./dnstt-server /usr/local/bin/dnstt-server
mkdir -p /etc/dnstt
/usr/local/bin/dnstt-server -gen-key -privkey-file /etc/dnstt/server.key -pubkey-file /etc/dnstt/server.pub
chmod 600 /etc/dnstt/server.key
chmod 644 /etc/dnstt/server.pub
```

На этом этапе у тебя уже есть:

- бинарник `/usr/local/bin/dnstt-server`;
- приватный ключ `/etc/dnstt/server.key`;
- публичный ключ `/etc/dnstt/server.pub`.

## Этап 4. Временный authoritative DNS для `eu.org`

Для `eu.org` сначала поднимается обычный authoritative DNS через `BIND9`. После одобрения домена `BIND9` отключается, а `UDP/53` отдаётся `dnstt-server`.

### Конфигурация `/etc/bind/named.conf.options`

```conf
options {
        directory "/var/cache/bind";

        recursion no;
        dnssec-validation no;

        listen-on { any; };
        listen-on-v6 { any; };

        allow-query { any; };
        allow-transfer { none; };

        auth-nxdomain no;
};
```

### Конфигурация `/etc/bind/named.conf.local`

Пример для домена `t.us.eu.org`:

```conf
zone "t.us.eu.org" {
        type master;
        file "/etc/bind/db.t.us.eu.org";
};
```

### Файл зоны `/etc/bind/db.t.us.eu.org`

```dns
$TTL 3600
@       IN      SOA     ns1.t.us.eu.org. root.t.us.eu.org. (
                        2026041801
                        3600
                        900
                        604800
                        3600
)

@       IN      NS      ns1.t.us.eu.org.
ns1     IN      A       123.123.123.123
```

### Права, проверка и запуск

```bash
chown root:bind /etc/bind/db.t.us.eu.org
chmod 0644 /etc/bind/db.t.us.eu.org

named-checkconf
named-checkzone t.us.eu.org /etc/bind/db.t.us.eu.org

systemctl restart named
systemctl enable named
systemctl status named --no-pager
```

## Этап 5. Проверка authoritative-ответов

Проверка локально:

```bash
dig @127.0.0.1 t.us.eu.org SOA +norecurse
dig @127.0.0.1 t.us.eu.org NS +norecurse
dig @127.0.0.1 ns1.t.us.eu.org A +norecurse
```

Проверка извне через IP VPS:

```bash
dig @123.123.123.123 t.us.eu.org SOA +norecurse
dig @123.123.123.123 t.us.eu.org NS +norecurse
dig @123.123.123.123 ns1.t.us.eu.org A +norecurse
```

Правильный ответ должен содержать флаг:

```text
flags: qr aa;
```

Если вместо этого виден referral вверх по зоне или нет `aa`, authoritative-конфигурация не готова.

## Этап 6. Что заполнять в форме `eu.org`

### Основные поля

- `Complete domain name` → `t.us.eu.org`
- `Check for correctness` → `server names + replies on SOA + replies on NS (recommended)`
- `Name1` → `ns1.t.us.eu.org`
- `IP1` → `123.123.123.123`

Остальные `Name2..Name9` и `IP2..IP9` можно оставить пустыми.

### Галочка `Private`

Опция `Private (not shown in the public Whois)` не влияет на работу туннеля. Она касается только отображения контактных данных.

### Как понять, что проверка прошла

Если форма отвечает примерно так:

```text
SOA ... serial ...
NS ... ok
No error, storing for validation...
Saved as request ...
```

значит DNS-часть подготовлена правильно и заявка поставлена в очередь.

## Этап 7. Ожидание одобрения домена

До одобрения домена:

- не останавливай `named`;
- не запускай `dnstt-server` на `:53`;
- не освобождай `UDP/53`.

Если `eu.org` повторно проверит делегируемый домен, сервер должен продолжать отвечать authoritative.

## Этап 8. Переключение с `BIND9` на `dnstt-server`

После одобрения домена:

```bash
systemctl stop named
systemctl disable named
```

### systemd unit `/etc/systemd/system/dnstt-server.service`

```ini
[Unit]
Description=DNSTT Server
After=network-online.target ssh.service
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/dnstt-server -udp :53 -privkey-file /etc/dnstt/server.key t.us.eu.org 127.0.0.1:22
Restart=always
RestartSec=2
User=root
WorkingDirectory=/etc/dnstt

[Install]
WantedBy=multi-user.target
```

### Активация сервиса

```bash
cat >/etc/systemd/system/dnstt-server.service <<'UNIT'
[Unit]
Description=DNSTT Server
After=network-online.target ssh.service
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/dnstt-server -udp :53 -privkey-file /etc/dnstt/server.key t.us.eu.org 127.0.0.1:22
Restart=always
RestartSec=2
User=root
WorkingDirectory=/etc/dnstt

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now dnstt-server
systemctl status dnstt-server --no-pager
```

## Этап 9. Проверка серверной части DNSTT

```bash
ss -lunp | grep ':53'
journalctl -u dnstt-server -n 50 --no-pager
journalctl -u dnstt-server -f
```

## Этап 10. Модель работы транспорта

На VPS сервер DNSTT остаётся одним и тем же. Выбор транспорта происходит на стороне клиента:

- `-doh`;
- `-dot`;
- `-udp`.

Это значит, что отдельный DoH-сервер на VPS не нужен. Публичный resolver используется как relay между клиентом и authoritative DNS-зоной DNSTT.

## Этап 11. Добавление дополнительных зон до одобрения

Если нужно быстро подать ещё один домен в `eu.org`, удобнее не заменять старую зону, а добавлять новую рядом.

Пример второй зоны:

```conf
zone "x9tt.us.eu.org" {
        type master;
        file "/etc/bind/db.x9tt.us.eu.org";
};
```

Пример файла зоны:

```dns
$TTL 3600
@       IN      SOA     ns1.x9tt.us.eu.org. root.x9tt.us.eu.org. (
                        2026041810
                        3600
                        900
                        604800
                        3600
)

@       IN      NS      ns1.x9tt.us.eu.org.
ns1     IN      A       123.123.123.123
```

После этого:

```bash
named-checkconf
named-checkzone x9tt.us.eu.org /etc/bind/db.x9tt.us.eu.org
systemctl restart named
```

## Этап 12. Типовые проблемы

### `Answer not authoritative`

Причина: `named` не отвечает как authoritative именно за нужную зону.

Что проверить:

- зона действительно добавлена в `named.conf.local`;
- файл зоны существует и читается;
- после рестарта `journalctl -u named` показывает `zone ... loaded serial ...`;
- `dig ... +norecurse` возвращает `flags: qr aa;`.

### `Connection refused` при проверке `eu.org`

Причина: на `UDP/53` никто не отвечает.

Что проверить:

```bash
systemctl status named --no-pager
ss -lunp | grep ':53'
```

### `bind9.service` не включается

На Debian рабочий unit может называться `named.service`. Это нормально. Используй:

```bash
systemctl status named --no-pager
systemctl restart named
systemctl enable named
```

### `network unreachable resolving ...`

Сообщения про IPv6 root-серверы в логах `named` не всегда означают проблему для authoritative-зоны. Если authoritative-ответы на `SOA/NS/A` идут с `aa`, критической ошибки нет.

## Итоговая схема

1. Поднять `BIND9` на `UDP/53`.
2. Подать домен в `eu.org`.
3. Дождаться одобрения.
4. Остановить `named`.
5. Запустить `dnstt-server` на `UDP/53`.
6. Использовать backend `127.0.0.1:22`.
7. На клиентах выбирать `DoH`, `DoT` или `UDP` через публичный relay.
