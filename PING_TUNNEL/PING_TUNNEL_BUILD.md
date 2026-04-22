# PING_TUNNEL_BUILD

## Назначение документа

Этот файл описывает варианты сборки и подготовки PingTunnel для разных конфигураций:

- использование готовых релизов;
- локальная сборка из исходников;
- сборка Android ABI;
- перенос бинарников в Android-модуль;
- типовые ошибки при сборке на Windows.

---

## 1. Самый простой путь: готовые релизы

Если нужен только запуск клиента или сервера, быстрее всего использовать готовые архивы со страницы релизов.

Типовой сценарий:

1. Открыть страницу релизов PingTunnel.
2. Скачать архив под нужную платформу.
3. Распаковать.
4. Запустить бинарник с подходящими флагами.

Примеры архивов:

- `pingtunnel_linux64.zip`
- `pingtunnel_windows64.zip`

Этот вариант подходит для:

- VPS-сервера;
- Windows-клиента;
- быстрой проверки работы туннеля;
- развёртывания без локальной компиляции.

---

## 2. Сборка из исходников

### Что потребуется

- установленный **Go**;
- доступ к репозиторию `esrrhs/pingtunnel`;
- для Android-сборки — **Android NDK**.

### Клонирование репозитория

```bash
git clone https://github.com/esrrhs/pingtunnel.git
cd pingtunnel
```

---

## 3. Сборка Android ABI на Windows

### Что потребуется

- Windows;
- Go в `PATH`;
- Android NDK;
- PowerShell;
- исходники PingTunnel.

### Важный момент про shell

Если команда запускается из **cmd.exe**, то переменные окружения задаются через `set`, а не через PowerShell-синтаксис.

Неправильно для `cmd.exe`:

```cmd
$env:ANDROID_NDK_HOME = "D:\ANDROID\SDK\ndk\29.0.14206865"
```

Правильно:

```cmd
set "ANDROID_NDK_HOME=D:\ANDROID\SDK\ndk\29.0.14206865"
```

### Важный момент про `pwsh`

Команда `pwsh` относится к **PowerShell 7**.  
Если она не установлена или не находится в `PATH`, используйте обычный Windows PowerShell:

```cmd
powershell -NoProfile -ExecutionPolicy Bypass -File .\build-android.ps1
```

### Важный момент про `RepoRoot`

Если `go.mod` лежит внутри `...\pingtunnel`, а сам скрипт запускается уровнем выше, нужно либо:

- запускать скрипт из каталога репозитория;
- либо явно передавать `-RepoRoot .\pingtunnel`.

Пример:

```cmd
cd /d C:\Users\rokky\Desktop\tun
set "ANDROID_NDK_HOME=D:\ANDROID\SDK\ndk\29.0.14206865"
powershell -NoProfile -ExecutionPolicy Bypass -File .\build-android.ps1 -RepoRoot .\pingtunnel
```

---

## 4. Результат Android-сборки

Практический результат сборки для Android обычно содержит четыре ABI:

```text
build\android\x86\pingtunnel
build\android\x86_64\pingtunnel
build\android\armeabi-v7a\pingtunnel
build\android\arm64-v8a\pingtunnel
```

Архивы могут выглядеть так:

```text
build\android\pingtunnel_android_386.zip
build\android\pingtunnel_android_amd64.zip
build\android\pingtunnel_android_arm.zip
build\android\pingtunnel_android_arm64.zip
```

### Какой ABI нужен чаще всего

Для современного Android-устройства почти всегда нужен:

```text
arm64-v8a
```

---

## 5. Перенос бинарников в Android-модуль

Если PingTunnel должен быть частью Android-приложения, итоговые бинарники раскладываются по ABI-каталогам модуля.

Пример целевой структуры:

```text
pingtunnel/
  src/
    main/
      jniLibs/
        x86/
        x86_64/
        armeabi-v7a/
        arm64-v8a/
```

Рекомендации:

- хранить отдельный бинарник для каждого ABI;
- не смешивать debug/release артефакты;
- проверять, что приложение реально пакует все нужные ABI;
- после обновления PingTunnel заменять весь комплект ABI сразу.

---

## 6. Проверка собранного Android-бинаря

После сборки полезно проверить бинарь через `adb`.

### Определить ABI устройства

```bash
adb shell getprop ro.product.cpu.abi
adb shell getprop ro.product.cpu.abilist
```

### Скопировать бинарник

```bash
adb push build/android/arm64-v8a/pingtunnel /data/local/tmp/pingtunnel
```

### Дать право на запуск

```bash
adb shell chmod 755 /data/local/tmp/pingtunnel
```

### Проверить запуск

```bash
adb shell /data/local/tmp/pingtunnel -h
```

Если задача — именно интеграция в приложение, следующий шаг обычно не ручной запуск через `adb`, а старт процесса из Android-кода.

---

## 7. Что считать успешной сборкой

Сборка считается корректной, если:

- `go build` завершается без ошибки;
- присутствуют бинарники всех нужных ABI;
- бинарник запускается на совместимом устройстве;
- приложение умеет найти и запустить этот бинарник;
- в рантайме появляется локальный listener и читаемые логи PingTunnel.

---

## 8. Частые ошибки и смысл сообщений

### `The filename, directory name, or volume label syntax is incorrect`

Обычно это значит, что PowerShell-синтаксис запустили внутри `cmd.exe`.

### `'pwsh' is not recognized as an internal or external command`

Обычно это значит, что PowerShell 7 не установлен или не добавлен в `PATH`.

### `go.mod not found in RepoRoot`

Обычно это значит, что скрипт смотрит не в корень репозитория PingTunnel, а уровнем выше.

### `go toolchain is not available in PATH`

Нужно добавить Go в `PATH` или запускать из shell, где Go уже доступен.

### `Android NDK LLVM toolchain not found`

Неверно указан путь к NDK или используется другой layout каталога NDK.

---

## 9. Практическая рекомендация для Android-проекта

Для Android-клиента удобно разделить процесс на два шага:

1. отдельная сборка ABI-бинарников;
2. упаковка этих бинарников в модуль `pingtunnel`.

Так проще:

- обновлять PingTunnel независимо от UI-кода;
- контролировать ABI-набор;
- тестировать раннер процесса отдельно от VPN-части приложения.

## Источники

- Официальный проект PingTunnel: <https://github.com/esrrhs/pingtunnel>
- Community Android client: <https://github.com/itismoej/pingtunnel-client>
- Android ICMP implementation: <https://github.com/esrrhs/pingtunnel/blob/master/icmp_listen_android.go>
