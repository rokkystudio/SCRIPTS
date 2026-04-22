# PING_TUNNEL_VPS

## Назначение документа

Этот файл описывает установку, запуск и эксплуатацию **PingTunnel Server** на VPS с публичным IP-адресом.

Документ рассчитан на Linux-сервер, где PingTunnel запускается как системный сервис.

---

## 1. Что нужно до установки

Перед началом нужны:

- VPS с публичным IP-адресом;
- root-доступ или возможность запускать команды через `sudo`;
- открытая ICMP-связность до сервера;
- скачанный архив PingTunnel под Linux.

Подойдут типовые VPS-провайдеры и облака, если у сервера есть внешний IP и ICMP не режется сетевой политикой. Официальный README описывает серверный запуск именно на машине с публичным IP и с root-правами.

---

## 2. Какая версия используется в примерах

В этом документе все команды привязаны к **стабильному numbered release `2.8`**. В репозитории `releases/latest` сейчас указывает на автоматический `master build`, поэтому для VPS в примерах используется именно фиксированный stable release, а не latest.

Это сделано специально, чтобы:

- команды не менялись из-за `master build`;
- сервер и клиент можно было держать на одной и той же версии;
- было проще понять, какой именно бинарник установлен на VPS.

---

## 3. Базовая установка вручную

### Скачать и распаковать

```bash
cd /opt
sudo mkdir -p /opt/pingtunnel
cd /opt/pingtunnel

sudo wget -O pingtunnel_linux_amd64.zip https://github.com/esrrhs/pingtunnel/releases/download/2.8/pingtunnel_linux_amd64.zip
sudo unzip -o pingtunnel_linux_amd64.zip
sudo chmod +x ./pingtunnel
```

### Зафиксировать установленную версию

`cat /opt/pingtunnel/VERSION` работает **только если этот файл был создан вручную**. Сам архив PingTunnel его не создаёт.

После установки удобно сразу сохранить номер версии рядом с бинарником:

```bash
echo '2.8' | sudo tee /opt/pingtunnel/VERSION >/dev/null
```

### Проверить запуск

```bash
sudo ./pingtunnel -type server -key 00000000
```

Где:

- `-type server` — серверный режим;
- `-key` — числовой ключ туннеля.

### Ограничение на `-key`

`-key` поддерживает только значения из диапазона:

```text
0..2147483647
```

Это ограничение указано в официальном README проекта.

---

## 4. Что будет, если не отключать обычный ping

Отключение системного ping в Linux для PingTunnel — **необязательный** шаг. В официальном README он помечен как optional.

Опциональная команда выглядит так:

```bash
echo 1 > /proc/sys/net/ipv4/icmp_echo_ignore_all
```

Если её **не выполнять**, то:

- ядро Linux продолжит отвечать на обычные ICMP Echo Request;
- сервер будет пинговаться стандартным `ping`;
- PingTunnel обычно продолжит работать.

Для Linux значение `net.ipv4.icmp_echo_ignore_all=0` означает обычные ответы на echo request, а `1` — игнорирование всех ICMP echo request. citeturn462260view0turn3file0

### Как проверить текущее состояние

```bash
sysctl net.ipv4.icmp_echo_ignore_all
```

Интерпретация:

- `0` — обычный ping включён;
- `1` — ядро игнорирует все ICMP Echo Request. citeturn3file0

### Как отключить временно

```bash
echo 1 | sudo tee /proc/sys/net/ipv4/icmp_echo_ignore_all
```

### Как отключить постоянно

Создайте файл:

```bash
sudo nano /etc/sysctl.d/99-pingtunnel.conf
```

С содержимым:

```conf
net.ipv4.icmp_echo_ignore_all = 1
```

Затем примените:

```bash
sudo sysctl --system
```

---

## 5. Запуск через systemd

Для постоянной работы на VPS удобнее использовать systemd.

### Базовый файл сервиса

```ini
[Unit]
Description=PingTunnel Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/pingtunnel
ExecStart=/opt/pingtunnel/pingtunnel -type server -key 00000000 -loglevel warn
Restart=always
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
```

### Размещение файла

```bash
sudo nano /etc/systemd/system/pingtunnel.service
```

Вставьте конфигурацию и сохраните.

### Перечитать конфигурацию systemd

```bash
sudo systemctl daemon-reload
```

### Включить автозапуск

```bash
sudo systemctl enable pingtunnel
```

### Запустить

```bash
sudo systemctl start pingtunnel
```

### Проверить статус

```bash
sudo systemctl status pingtunnel
```

---

## 6. Как узнать, какая версия установлена на сервере

### Почему `cat /opt/pingtunnel/VERSION` у вас не сработал

Это нормальное поведение, если файл `VERSION` **не создавался вручную** во время установки. Сам по себе архив `pingtunnel_linux_amd64.zip` этот файл не добавляет, поэтому в каталоге могут лежать только бинарник и лог-файлы. citeturn316459search2

### Лучший практический способ

После установки один раз создайте файл версии:

```bash
echo '2.8' | sudo tee /opt/pingtunnel/VERSION >/dev/null
```

Потом проверка будет простой:

```bash
cat /opt/pingtunnel/VERSION
```

### Если файл VERSION не создан

Вы не сможете определить версию релиза!

Если требуется точное подтверждение версии, то выполните переустановку.

---

## 7. Влияет ли версия на VPS на клиент

Да, влияет в практическом смысле.

Рекомендуемый вариант такой:

- VPS и клиенты используют **одну и ту же numbered stable version**;
- Android- и desktop-клиенты обновляются вместе с сервером.

Это снижает риск расхождений между numbered release и более новыми `master build` сборками. В репозитории одновременно доступны и `2.8`, и более новые автоматические `master build` релизы. citeturn316459search2

Если VPS установлен на `2.8`, клиентскую сторону тоже лучше держать на `2.8`.

---

## 8. Настройка логов на VPS

### Почему у вас появляются большие лог-файлы

У PingTunnel есть встроенное файловое логирование. В доступных описаниях
параметров CLI есть флаги `-nolog`, `-noprint` и `-loglevel`, а в разборе кода видно,
что логгер инициализируется с `Level`, `NoLogFile`, `NoPrint` и `MaxDay: 3`.

Старые логи по умолчанию ротируются, удаляются по встроенной политике хранения.

### Вариант 1. Оставить только WARN и ERROR

Если нужно уменьшить объём логов, запускайте сервер с уровнем `warn`:

```ini
[Service]
Type=simple
WorkingDirectory=/opt/pingtunnel
ExecStart=/opt/pingtunnel/pingtunnel -type server -key 00000000 -loglevel warn
Restart=always
RestartSec=3
User=root
```

По описанию параметров `-loglevel` меняет уровень файлового лога, а по умолчанию используется `info`. citeturn486315search4turn268429search4

### Вариант 2. Не писать лог-файлы, но оставить вывод в journal

Если не нужны `.log` файлы в `/opt/pingtunnel`, но нужен просмотр через `journalctl`, добавьте `-nolog 1`:

```ini
[Service]
Type=simple
WorkingDirectory=/opt/pingtunnel
ExecStart=/opt/pingtunnel/pingtunnel -type server -key 00000000 -loglevel warn -nolog 1
Restart=always
RestartSec=3
User=root
```

По описанию параметров `-nolog` отключает запись лог-файлов и оставляет вывод в стандартный поток. Для systemd это значит, что сообщения продолжат попадать в journal. citeturn486315search4turn486315search1

Просмотр:

```bash
sudo journalctl -u pingtunnel -f
```

### Вариант 3. Почти полностью выключить логи

Если не нужны ни файлы, ни stdout/stderr, используйте сразу `-nolog 1 -noprint 1`:

```ini
[Service]
Type=simple
WorkingDirectory=/opt/pingtunnel
ExecStart=/opt/pingtunnel/pingtunnel -type server -key 00000000 -nolog 1 -noprint 1
Restart=always
RestartSec=3
User=root
```

По описанию параметров `-noprint` отключает вывод в стандартный поток, а `-nolog` отключает запись лог-файлов. В такой конфигурации логирование становится минимальным. citeturn486315search4turn486315search1

### Как применить новую настройку логов

После изменения unit-файла выполните:

```bash
sudo systemctl daemon-reload
sudo systemctl restart pingtunnel
sudo systemctl status pingtunnel
```

### Как быстро проверить, откуда сейчас берутся логи

```bash
sudo systemctl cat pingtunnel
ls -lah /opt/pingtunnel
sudo journalctl -u pingtunnel -n 50
```

Если после `-nolog 1` новые `.log` файлы перестали расти, а сообщения остались в `journalctl`, значит файловое логирование отключено и сервис пишет только в journal. Если добавлен ещё и `-noprint 1`, то журнал тоже должен стать почти пустым. Описание поведения этих флагов следует из параметров CLI. citeturn486315search4turn486315search1

### Что делать с уже накопленными логами

После смены конфигурации старые файлы можно удалить вручную:

```bash
cd /opt/pingtunnel
sudo rm -f ./*.log
```

Удаляйте их после того, как убедились, что сервис уже перезапущен с нужными флагами.

---

## 9. Проверка после запуска

### Статус процесса

```bash
ps aux | grep pingtunnel
```

### Логи сервиса

```bash
sudo journalctl -u pingtunnel -f
```

### Проверка с клиента

Запустите клиент и смотрите его логи.
Если клиент показывает `ping/pong`, базовая связность между клиентом и сервером есть. Это прямо указано в официальном README. citeturn462260view0

---

## 10. Что важно для сетевой доступности

### ICMP

PingTunnel использует ICMP как транспорт. Если провайдер, VPS или внешний firewall режет ICMP, туннель работать не будет. Это следует из самого назначения проекта и из официального README. citeturn462260view0

### Security Group / Cloud Firewall

Если сервер находится в облаке, проверьте правила безопасности:

- разрешён ли входящий ICMP;
- не режется ли исходящий ICMP;
- нет ли отдельной политики у провайдера.

---

## 11. Почему сервер запускается от root

Официальный сценарий запуска сервера описан с root-правами. Для Linux/VPS это нужно учитывать сразу в операционной схеме. citeturn462260view0

Рекомендации:

- выделить отдельный сервер или отдельный сервис под PingTunnel;
- хранить бинарник и конфиг в выделенном каталоге;
- управлять жизненным циклом через systemd;
- обновлять бинарник через controlled rollout, а не вручную поверх работающего процесса.

---

## 12. Обновление сервера

Типовой безопасный порядок:

1. скачать новый релиз;
2. остановить сервис;
3. заменить бинарник;
4. проверить права на исполнение;
5. обновить файл `VERSION`, если вы его используете;
6. снова запустить сервис;
7. проверить `systemctl status` и `journalctl`.

Пример для повторной установки `2.8`:

```bash
cd /opt/pingtunnel
sudo systemctl stop pingtunnel
sudo wget -O pingtunnel_linux_amd64.zip https://github.com/esrrhs/pingtunnel/releases/download/2.8/pingtunnel_linux_amd64.zip
sudo unzip -o pingtunnel_linux_amd64.zip
sudo chmod +x ./pingtunnel
echo '2.8' | sudo tee /opt/pingtunnel/VERSION >/dev/null
sudo systemctl start pingtunnel
sudo systemctl status pingtunnel
```

Релиз `2.8` доступен на странице numbered releases проекта. citeturn316459search2

---

## 13. Минимальный чек-лист

Сервер считается готовым, если:

- VPS имеет публичный IP;
- бинарник PingTunnel скачан и распакован;
- версия установки зафиксирована, если вы используете файл `VERSION`;
- сервис запущен от root;
- уровень логирования выбран осознанно;
- ICMP не режется по пути;
- клиент получает `ping/pong`;
- systemd показывает `active (running)`.

## Источники

- Официальный проект PingTunnel: https://github.com/esrrhs/pingtunnel
- Releases PingTunnel: https://github.com/esrrhs/pingtunnel/releases
- Linux kernel docs по `icmp_echo_ignore_all`: https://docs.kernel.org/networking/ip-sysctl.html
