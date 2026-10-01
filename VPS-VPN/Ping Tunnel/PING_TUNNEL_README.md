# Pingtunnel [![Go Report Card](https://goreportcard.com/badge/github.com/esrrhs/pingtunnel)](https://goreportcard.com/report/github.com/esrrhs/pingtunnel)

[Оригинальный репозиторий](https://github.com/esrrhs/pingtunnel)

Pingtunnel — это инструмент для передачи TCP/UDP-трафика поверх ICMP.

## Примечание: этот инструмент предназначен только для обучения и исследований, не используйте его в незаконных целях

![image](https://raw.githubusercontent.com/esrrhs/pingtunnel/master/network.jpg)

## Использование

### Установка сервера

- Сначала подготовьте сервер с публичным IP-адресом, например EC2 в AWS. Предположим, что доменное имя или публичный IP-адрес сервера — `www.yourserver.com`.
- Скачайте соответствующий установочный пакет со страницы [releases](https://github.com/esrrhs/pingtunnel/releases), например `pingtunnel_linux64.zip`, затем распакуйте его и запустите с правами **root**.
- Параметр `-key` имеет тип **int** и поддерживает только числа в диапазоне `0–2147483647`.

```bash
sudo wget (ссылка на последний релиз)
sudo unzip pingtunnel_linux64.zip
sudo ./pingtunnel -type server
```

- (Необязательно) Отключить системный ping по умолчанию.

```bash
echo 1 > /proc/sys/net/ipv4/icmp_echo_ignore_all
```

### Установка клиента

- Скачайте соответствующий установочный пакет со страницы [releases](https://github.com/esrrhs/pingtunnel/releases), например `pingtunnel_windows64.zip`, и распакуйте его.
- Затем запустите его с правами **администратора**. Команды для разных вариантов перенаправления приведены ниже.
- Если вы видите в логах `ping pong`, значит соединение установлено нормально.
- Параметр `-key` имеет тип **int** и поддерживает только числа в диапазоне `0–2147483647`.

#### Проксирование SOCKS5

```bash
pingtunnel.exe -type client -l :4455 -s www.yourserver.com -sock5 1
```

#### Проксирование TCP

```bash
pingtunnel.exe -type client -l :4455 -s www.yourserver.com -t www.yourserver.com:4455 -tcp 1
```

#### Проксирование UDP

```bash
pingtunnel.exe -type client -l :4455 -s www.yourserver.com -t www.yourserver.com:4455
```

### Использование Android-клиента

Теперь доступен специальный Android-клиент для pingtunnel, разработанный сообществом.

- [**pingtunnel-client**](https://github.com/itismoej/pingtunnel-client)

> Большое спасибо [itismoej](https://github.com/itismoej) за разработку этого Android-клиента!

### Использование Docker

Приложение также можно запускать напрямую через Docker, что удобнее. Параметры те же, что и выше.

- server:

```bash
docker run --name pingtunnel-server -d --privileged --network host --restart=always esrrhs/pingtunnel ./pingtunnel -type server -key 123456
```

- client:

```bash
docker run --name pingtunnel-client -d --restart=always -p 1080:1080 esrrhs/pingtunnel ./pingtunnel -type client -l :1080 -s www.yourserver.com -sock5 1 -key 123456
```

## Спасибо за бесплатную Open Source-лицензию JetBrains
