# PROXY_TLS_CHECK

Скрипт проверяет один `host:port` и определяет, какие proxy-протоколы реально принимаются на этом порту:

- plain HTTP proxy по TCP;
- HTTP proxy поверх TLS;
- SOCKS5 с аутентификацией `username/password`.

На выходе скрипт печатает JSON-отчёт с:

- параметрами проверяемого endpoint;
- целевым `target_host:target_port` для `CONNECT`;
- итоговой классификацией;
- подробными результатами по каждому probe.

## Безопасность

Скрипт не содержит зашитых значений proxy endpoint, логина и пароля.

Для запуска необходимо явно передать:

- `--host`
- `--port`
- `--username`
- `--password`

Это позволяет публиковать репозиторий без встроенных чувствительных данных.

## Что именно проверяется

### 1. `http_plain`

Подключение по обычному TCP, затем отправка HTTP `CONNECT` с `Proxy-Authorization: Basic ...`.

Успехом считается корректный HTTP-ответ со статусом `2xx`.

### 2. `http_tls`

Сначала выполняется TLS handshake с proxy endpoint, затем через установленный TLS-канал отправляется тот же HTTP `CONNECT`.

Успехом считается:

- успешный TLS handshake;
- корректный HTTP-ответ;
- статус `2xx`.

### 3. `socks5`

Проверяется SOCKS5-сценарий с методом аутентификации `username/password`, затем отправляется `CONNECT` к целевому адресу.

Успехом считается ответ SOCKS5 с кодом `0x00`.

## Классификация

Скрипт использует такие итоговые метки:

- `HTTP_ONLY` — работает только plain HTTP proxy;
- `HTTP_PLUS_TLS` — работают и plain HTTP proxy, и HTTP proxy поверх TLS на одном порту;
- `HTTPS_ONLY` — работает только HTTP proxy поверх TLS;
- `SOCKS5_ONLY` — работает только SOCKS5;
- `MIXED_WITH_SOCKS5` — SOCKS5 работает вместе хотя бы с одним HTTP-режимом;
- `UNKNOWN` — ни один из тестируемых протоколов не завершился успешно.

## Требования

- Python 3.10+;
- доступ к сети до тестируемого proxy endpoint.

Сторонние зависимости не требуются.

## Запуск

### Базовый запуск

```bash
python PROXY_TLS_CHECK.py \
  --host proxy.example.net \
  --port 1080 \
  --username YOUR_USERNAME \
  --password YOUR_PASSWORD \
  --pretty
```

### Запуск с явным target

```bash
python PROXY_TLS_CHECK.py \
  --host proxy.example.net \
  --port 1080 \
  --username YOUR_USERNAME \
  --password YOUR_PASSWORD \
  --target-host example.com \
  --target-port 443 \
  --timeout 8 \
  --read-limit 8192 \
  --pretty
```

## Аргументы CLI

### Обязательные

- `--host` — hostname или IP proxy endpoint;
- `--port` — порт proxy endpoint;
- `--username` — логин для proxy;
- `--password` — пароль для proxy.

### Необязательные

- `--target-host` — адрес назначения для `CONNECT`, по умолчанию `example.com`;
- `--target-port` — порт назначения для `CONNECT`, по умолчанию `443`;
- `--timeout` — timeout сокета в секундах, по умолчанию `8.0`;
- `--read-limit` — максимум байт, читаемых в HTTP probe, по умолчанию `8192`;
- `--pretty` — форматированный вывод JSON.

## Пример результата

```json
{
  "endpoint": {
    "host": "proxy.example.net",
    "port": 1080,
    "username": "user1",
    "password_length": 12
  },
  "target": {
    "host": "example.com",
    "port": 443
  },
  "classification": {
    "label": "HTTP_PLUS_TLS",
    "http_plain_ok": true,
    "http_tls_ok": true,
    "socks5_ok": false,
    "notes": [
      "The same port accepted plain HTTP proxy and HTTP proxy over TLS."
    ]
  },
  "probes": {
    "http_plain": {
      "name": "http_plain",
      "ok": true,
      "protocol_detected": true,
      "transport": "tcp",
      "latency_ms": 41.52,
      "error": null,
      "details": {
        "status_line": "HTTP/1.1 200 Connection established"
      }
    },
    "http_tls": {
      "name": "http_tls",
      "ok": true,
      "protocol_detected": true,
      "transport": "tls",
      "latency_ms": 73.11,
      "error": null,
      "details": {
        "tls": {
          "version": "TLSv1.3"
        },
        "status_line": "HTTP/1.1 200 Connection established"
      }
    },
    "socks5": {
      "name": "socks5",
      "ok": false,
      "protocol_detected": false,
      "transport": "tcp",
      "latency_ms": 18.44,
      "error": "endpoint did not return a SOCKS5 greeting reply",
      "details": {}
    }
  }
}
```

## BAT-файл

В репозитории есть `PROXY_TLS_CHECK.bat`:

```bat
@echo off
python PROXY_TLS_CHECK.py --pretty %*
pause
```

Он прокидывает все переданные аргументы в Python-скрипт.

Пример запуска в Windows:

```bat
PROXY_TLS_CHECK.bat --host proxy.example.net --port 1080 --username YOUR_USERNAME --password YOUR_PASSWORD
```

## Интерпретация результата

Стоит учитывать два разных уровня сигнала:

- `ok=true` — протокол полностью прошёл успешный сценарий;
- `protocol_detected=true` и `ok=false` — endpoint говорит на ожидаемом протоколе, но запрос не завершился успехом из-за политики доступа, неверных прав, ошибки `CONNECT` или отказа в аутентификации.

Это полезно, когда нужно отличить:

- неправильный протокол на порту;
- корректный протокол с отказом по доступу;
- успешную рабочую конфигурацию.

## Ограничения

- HTTP-проверки используют `CONNECT`, поэтому endpoint должен поддерживать tunnel-сценарий;
- TLS context создан без проверки сертификата, чтобы отделять ошибки trust chain от ошибок определения протокола;
- для SOCKS5 используется только вариант аутентификации `username/password`.
