# DNS_TUNNEL_BUILD

## Назначение

Этот документ описывает сборку и запуск клиентской части DNSTT для:

- ПК: Linux, macOS, Windows;
- Android: через отдельный Android-плагин и совместимое клиентское окружение.

Основной путь для проекта — **сборка клиента для ПК**, потому что это прямой и понятный способ работы с upstream DNSTT. Android-сценарий возможен, но он заметно менее прямолинеен.

## Что нужно клиенту

На клиенте требуется только:

- бинарник `dnstt-client`;
- публичный ключ сервера `server.pub`;
- домен туннеля, например `t.us.eu.org`;
- выбранный транспорт: `DoH`, `DoT` или `UDP`.

Приватный ключ `server.key` на клиенте не используется.

## Часть 1. Сборка клиента для ПК

### Linux / macOS

```bash
git clone https://www.bamsoftware.com/git/dnstt.git
cd dnstt/dnstt-client
go build
```

После сборки в каталоге появится бинарник `dnstt-client`.

### Windows

#### Сборка в Go под Windows

На любой машине с Go можно собрать Windows-бинарник так:

```bash
git clone https://www.bamsoftware.com/git/dnstt.git
cd dnstt/dnstt-client
GOOS=windows GOARCH=amd64 go build -o dnstt-client.exe
```

Если нужен ARM64-вариант:

```bash
GOOS=windows GOARCH=arm64 go build -o dnstt-client.exe
```

### Что скопировать рядом с клиентом

С сервера нужно забрать публичный ключ:

```bash
scp root@SERVER_IP:/etc/dnstt/server.pub .
```

## Часть 2. Базовые команды запуска клиента

Ниже `t.us.eu.org` — пример домена туннеля, а `127.0.0.1:8000` — локальная точка входа на клиенте.

### DoH

```bash
./dnstt-client -doh https://doh.example/dns-query -pubkey-file server.pub t.us.eu.org 127.0.0.1:8000
```

### DoT

```bash
./dnstt-client -dot dot.example:853 -pubkey-file server.pub t.us.eu.org 127.0.0.1:8000
```

### UDP

```bash
./dnstt-client -udp 9.9.9.9:53 -pubkey-file server.pub t.us.eu.org 127.0.0.1:8000
```

## Часть 3. Как использовать туннель на ПК

### Вариант 1. SSH через локальный порт

Если на сервере DNSTT настроен backend `127.0.0.1:22`, то после запуска клиента можно подключаться так:

```bash
ssh -p 8000 127.0.0.1
```

### Вариант 2. Локальный SOCKS5 через SSH

Это самый удобный сценарий для браузера и приложений:

```bash
ssh -N -D 127.0.0.1:7000 -o HostKeyAlias=tunnel-server -p 8000 127.0.0.1
```

После этого приложения используют SOCKS5:

- host: `127.0.0.1`
- port: `7000`

Проверка:

```bash
curl --proxy socks5h://127.0.0.1:7000 https://wtfismyip.com/text
```

## Часть 4. Готовые launcher-скрипты для ПК

### `run-doh.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

./dnstt-client \
  -doh https://doh.example/dns-query \
  -pubkey-file server.pub \
  t.us.eu.org \
  127.0.0.1:8000
```

### `run-dot.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

./dnstt-client \
  -dot dot.example:853 \
  -pubkey-file server.pub \
  t.us.eu.org \
  127.0.0.1:8000
```

### `run-udp.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

./dnstt-client \
  -udp 9.9.9.9:53 \
  -pubkey-file server.pub \
  t.us.eu.org \
  127.0.0.1:8000
```

## Часть 5. Android

## Что важно

Upstream DNSTT ориентирован прежде всего на обычный клиент `dnstt-client` для ПК. Для Android используется отдельная ветка с интеграцией в модель плагинов, а не прямой запуск стандартного desktop-клиента в том виде, как на Linux или Windows.

Из практической точки зрения Android-сценарий лучше воспринимать так:

- сервер остаётся тем же самым;
- authoritative-домен остаётся тем же самым;
- транспортная логика DNSTT остаётся той же самой;
- Android-клиент требует отдельной сборки или готового APK в виде плагина.

## Вариант A. Использовать готовую Android-ветку

Если нужен именно Android-клиент DNSTT, ориентируйся на Android-плагин, а не на прямой запуск desktop-сборки. Это наиболее реалистичный путь для телефона.

Общая идея такая:

1. установить Android Studio;
2. скачать исходники Android-плагина DNSTT;
3. открыть проект Gradle;
4. собрать APK;
5. использовать его вместе с совместимым клиентским приложением, поддерживающим схему плагинов.

## Вариант B. Сборка Android-плагина из исходников

### Что потребуется

- Android Studio;
- Android SDK;
- Android NDK, если проект этого требует;
- JDK;
- Gradle wrapper из репозитория.

### Общая последовательность

```bash
git clone https://github.com/Mygod/dnstt-plugin-android.git
cd dnstt-plugin-android
./gradlew assembleDebug
```

Если окружение подготовлено корректно, APK появится в стандартном Gradle-пути внутри каталога `app/build/outputs/apk/`.

## Ограничения Android-сценария

- Android-ветка не является таким же прямым и простым путём, как `dnstt-client` на ПК.
- Для Android удобнее использовать уже готовую инфраструктуру вокруг плагина, а не собирать чистый upstream-клиент вручную.
- Если нужен быстрый рабочий результат, ПК-клиент обычно быстрее в настройке и отладке.

## Часть 6. Что лучше выбрать

### Если нужен самый понятный запуск

Выбирай ПК-клиент:

- проще собрать;
- проще отлаживать;
- проще проверять `DoH`, `DoT`, `UDP`;
- легко строится локальный SOCKS5 через `ssh -D`.

### Если нужен телефон

Используй Android-плагин как отдельную клиентскую ветку. Серверную часть DNSTT при этом менять не нужно.

## Часть 7. Проверка клиента

### Клиент запущен

Если `dnstt-client` стартовал без ошибки, локальный TCP-порт должен быть занят:

```bash
ss -ltnp | grep ':8000'
```

### Проверка SSH через туннель

```bash
ssh -vv -p 8000 127.0.0.1
```

### Проверка через SOCKS5

```bash
curl --proxy socks5h://127.0.0.1:7000 https://example.com/
```

## Часть 8. Типовые ошибки

### `connection refused`

Причины:

- `dnstt-client` не запущен;
- серверный backend `127.0.0.1:22` не работает;
- `dnstt-server` не слушает `UDP/53`.

### Клиент запускается, но трафик не проходит

Проверь:

- верный ли домен туннеля;
- совпадает ли `server.pub` с сервером;
- делегирована ли authoritative-зона;
- отвечает ли сервер DNSTT на `UDP/53`.

### `DoH` или `DoT` работает нестабильно

Проверь:

- выбранный публичный resolver;
- корректность URL/адреса;
- необходимость уменьшить `-mtu`.

Пример:

```bash
./dnstt-client -doh https://doh.example/dns-query -pubkey-file server.pub -mtu 512 t.us.eu.org 127.0.0.1:8000
```

## Итог

Для этого проекта рекомендуемый путь такой:

1. основной клиент — ПК-сборка `dnstt-client`;
2. основной транспорт — `DoH`;
3. резерв — `DoT`;
4. тестовый режим — `UDP`;
5. Android использовать как отдельную ветку через плагин, если действительно нужен мобильный клиент.
