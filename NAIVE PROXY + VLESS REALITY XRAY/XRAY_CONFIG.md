# README

## Xray REALITY с нуля

Этот README описывает создание нового серверного `config.json` для `Xray + VLESS + REALITY`.

---

## Что должно уже быть

- Xray уже установлен.
- `xray.service` уже настроен через systemd.
- Xray запускается из:
  ```bash
  /usr/local/bin/xray
  ```
- Конфиг будет лежать в:
  ```bash
  /usr/local/etc/xray/config.json
  ```

Проверка:

```bash
which xray || ls -l /usr/local/bin/xray
systemctl cat xray.service
```

---

## 1. Проверка кандидата на роль REALITY target

Сначала проверяется выбранный `target`:

```bash
xray tls ping amazon.com:443
```

Смотреть нужно на такие признаки:

- `Handshake succeeded`
- `TLS Version: TLS 1.3`
- при `Pinging with SNI` сертификат разрешает домен `amazon.com`
- нет странного поведения на handshake

---

## 2. Генерация параметров сервера

```bash
TARGET_DOMAIN=amazon.com
TARGET_PORT=443
XRAY_PORT=8443

UUID=$(/usr/local/bin/xray uuid)

KEYS=$(/usr/local/bin/xray x25519)
PRIVATE_KEY=$(printf '%s\n' "$KEYS" | awk '/Private/{print $3}')
PUBLIC_KEY=$(printf '%s\n' "$KEYS" | awk '/Public/{print $3}')

SHORT_ID=$(openssl rand -hex 8)

printf 'UUID=%s\nPUBLIC_KEY=%s\nPRIVATE_KEY=%s\nSHORT_ID=%s\nSERVER_NAME=%s\n' \
  "$UUID" "$PUBLIC_KEY" "$PRIVATE_KEY" "$SHORT_ID" "$TARGET_DOMAIN"
```

После выполнения обязательно сохрани себе значения:

- `UUID`
- `PUBLIC_KEY`
- `SHORT_ID`
- `SERVER_NAME`

`PRIVATE_KEY` остаётся только на сервере.

---

## 3. Создание нового config.json

```bash
install -d -m 0755 /usr/local/etc/xray

cat >/usr/local/etc/xray/config.json <<EOF
{
  "log": {
    "loglevel": "warning"
  },
  "inbounds": [
    {
      "listen": "::",
      "port": $XRAY_PORT,
      "protocol": "vless",
      "settings": {
        "clients": [
          {
            "id": "$UUID",
            "flow": "xtls-rprx-vision"
          }
        ],
        "decryption": "none"
      },
      "streamSettings": {
        "network": "raw",
        "security": "reality",
        "realitySettings": {
          "show": false,
          "target": "$TARGET_DOMAIN:$TARGET_PORT",
          "serverNames": [
            "$TARGET_DOMAIN"
          ],
          "privateKey": "$PRIVATE_KEY",
          "shortIds": [
            "$SHORT_ID"
          ]
        }
      },
      "sniffing": {
        "enabled": true,
        "destOverride": [
          "http",
          "tls",
          "quic"
        ]
      }
    }
  ],
  "outbounds": [
    {
      "protocol": "freedom",
      "tag": "direct"
    },
    {
      "protocol": "blackhole",
      "tag": "block"
    }
  ]
}
EOF
```

---

## 4. Установка jq

Если `jq` отсутствует, установи его:

```bash
apt-get update
apt-get install -y jq
```

Проверка:

```bash
jq --version
```

---

## 5. Проверка JSON и запуск

```bash
jq . /usr/local/etc/xray/config.json >/dev/null
systemctl restart xray
systemctl status xray --no-pager -l
ss -ltnp | grep 8443
```

---

## 6. Что перенести в клиент

На клиенте для sing-box / Xray нужно использовать:

- `server`: IP или домен твоего VPS
- `server_port`: `8443`
- `uuid`: значение из `UUID`
- `public_key`: значение из `PUBLIC_KEY`
- `short_id`: значение из `SHORT_ID`
- `server_name`: значение из `SERVER_NAME`

То есть для этого примера:

```json
{
  "type": "vless",
  "server": "YOUR_VPS_IP",
  "server_port": 8443,
  "uuid": "UUID_FROM_SERVER",
  "flow": "xtls-rprx-vision",
  "tls": {
    "enabled": true,
    "server_name": "amazon.com",
    "utls": {
      "enabled": true,
      "fingerprint": "chrome"
    },
    "reality": {
      "enabled": true,
      "public_key": "PUBLIC_KEY_FROM_SERVER",
      "short_id": "SHORT_ID_FROM_SERVER"
    }
  }
}
```

---

## 7. Как проверить, что серверный конфиг содержит правильные значения

```bash
grep -n '"target"\|"serverNames"\|"privateKey"\|"shortIds"\|"id"\|"flow"' /usr/local/etc/xray/config.json
```

---

## 8. Быстрое изменение target и server_name, даже если старое значение неизвестно

Этот вариант не требует знать, какой домен был выбран раньше.

```bash
TARGET_DOMAIN=example.com
TARGET_PORT=443

jq --arg target "$TARGET_DOMAIN:$TARGET_PORT" --arg serverName "$TARGET_DOMAIN" '
  (.inbounds[] | select(.streamSettings.security == "reality") | .streamSettings.realitySettings.target) = $target
  |
  (.inbounds[] | select(.streamSettings.security == "reality") | .streamSettings.realitySettings.serverNames) = [$serverName]
' /usr/local/etc/xray/config.json > /usr/local/etc/xray/config.json.tmp && \
mv /usr/local/etc/xray/config.json.tmp /usr/local/etc/xray/config.json
```

Проверка:

```bash
grep -n '"target"\|"serverNames"' /usr/local/etc/xray/config.json
jq . /usr/local/etc/xray/config.json >/dev/null
systemctl restart xray
systemctl status xray --no-pager -l
```

После этого на клиенте тоже нужно поменять:

```json
"server_name": "example.com"
```

Если клиентский `server_name` не будет совпадать с новым серверным `serverNames`, подключение, скорее всего, не будет работать.

---

## 9. Как потом поменять target на другой

### 9.1. Проверить нового кандидата

```bash
xray tls ping NEW_DOMAIN:443
```

### 9.2. Что должно совпадать

Если меняется `target`, то вместе с ним обычно меняются:

- `realitySettings.target`
- `realitySettings.serverNames`
- клиентский `server_name`

### 9.3. Что обычно не нужно менять

Обычно не нужно менять:

- `UUID`
- `PRIVATE_KEY`
- `PUBLIC_KEY`
- `SHORT_ID`

Если ты просто меняешь `target/server_name`, то ключи и идентификатор клиента могут остаться прежними.

---

## 10. Критерии выбора REALITY target

Подходящий `target` должен:

- быть не `.ru`, если потом планируется блокировка российских ресурсов;
- поддерживать `TLS 1.3`;
- нормально отвечать на handshake с нужным `SNI`;
- отдавать сертификат, где выбранный домен есть в `SAN`;
- быть обычным HTTPS-сайтом с предсказуемым поведением;
- не быть слишком экзотическим.

### Почему CDN не подходят

Для REALITY не стоит использовать CDN-цели, особенно Cloudflare-подобные сценарии.

Причины:

- поведение на handshake может быть нестабильным;
- fallback / forwarding для REALITY становится менее предсказуемым;
- один и тот же домен может вести себя по-разному в зависимости от PoP;
- такой `target` хуже подходит для воспроизводимой конфигурации.

Поэтому лучше использовать обычный сайт с прямым и предсказуемым HTTPS-поведением, а не CDN-frontend.
