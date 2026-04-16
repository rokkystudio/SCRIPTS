# sing-box / libbox сборка (Android + Windows)

Короткий рабочий мануал под текущую схему.

## Что в итоге собираем

- **Android AAR** с:
  - `io.nekohasekai.libbox`
  - **4 ABI**: `armeabi-v7a`, `arm64-v8a`, `x86`, `x86_64`
  - включёнными `with_gvisor`, `with_utls`, `with_naive_outbound`
- **Windows x64**: `sing-box.exe`
- Java для этой сборки: **Oracle JDK 17**
- Репозиторий: `C:\Users\rokky\Desktop\sing-box-1.14.0-alpha.12`

## Пути

```text
Repo:         C:\Users\rokky\Desktop\sing-box-1.14.0-alpha.12
JAVA_HOME:    C:\Program Files\Java\jdk-17
ANDROID_HOME: D:\ANDROID\SDK
NDK:          D:\ANDROID\SDK\ndk\29.0.14206865
```

## Куда положить GO-файл

Подготовленный `main.go` класть сюда:

```text
C:\Users\rokky\Desktop\sing-box-1.14.0-alpha.12\cmd\internal\build_libbox\main.go
```

Файл нужно **заменить целиком**.

## Что важно перед сборкой

- не использовать готовые `.so` из релизных `apk` / `tar.gz` как есть
- не смешивать старые Java bindings и новую нативку
- использовать **один комплект**:
  - `go/*`
  - `io/nekohasekai/libbox/*`
  - `jni/*/libgojni.so`
- Android-комплект использует **`libgojni.so`**, а не `libbox.so`
- `legacy` не нужен
- `naive` обязателен

## Что уже подтверждено этой сборкой

В успешной Android-сборке были:

- `github.com/sagernet/sing-box/protocol/naive`
- `github.com/sagernet/sing-box/protocol/naive/quic`

Итоговый AAR содержит:

- `io/nekohasekai/libbox/*`
- `go/*`
- `jni/armeabi-v7a/libgojni.so`
- `jni/arm64-v8a/libgojni.so`
- `jni/x86/libgojni.so`
- `jni/x86_64/libgojni.so`

## Подготовка окружения (PowerShell)

Открыть PowerShell в корне репозитория и выполнить:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-17'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
$env:ANDROID_HOME = 'D:\ANDROID\SDK'
$env:ANDROID_NDK_HOME = 'D:\ANDROID\SDK\ndk\29.0.14206865'
$env:ANDROID_NDK_ROOT = $env:ANDROID_NDK_HOME
```

Проверка:

```powershell
& "$env:JAVA_HOME\bin\java.exe" --version
where.exe java
Test-Path "$env:ANDROID_NDK_HOME\toolchains\llvm\prebuilt\windows-x86_64\bin\clang.exe"
```

## Установка gomobile / gobind

```powershell
go install github.com/sagernet/gomobile/cmd/gomobile@v0.1.12
go install github.com/sagernet/gomobile/cmd/gobind@v0.1.12
where.exe gomobile
where.exe gobind
```

## Android сборка

```powershell
gomobile clean
gomobile init -ndk "$env:ANDROID_NDK_HOME"
go run .\cmd\internal\build_libbox -target android
```

## Что должно получиться после Android сборки

Главный артефакт:

```text
libbox.aar
```

Внутри должны быть:

```text
go/*
io/nekohasekai/libbox/*
jni/armeabi-v7a/libgojni.so
jni/arm64-v8a/libgojni.so
jni/x86/libgojni.so
jni/x86_64/libgojni.so
```

## Что переносить в LOKI

Из новой Android сборки переносить **вместе**:

- `go/*`
- `io/nekohasekai/libbox/*`
- все 4 `libgojni.so`

Перед заменой удалить старые bindings и старые нативки.  
Нельзя оставлять рядом старые `go/*`, `io/nekohasekai/libbox/*`, `libbox.so`.

## Windows x64 сборка

Из корня репозитория:

```powershell
$windowsTags = 'with_gvisor,with_quic,with_dhcp,with_wireguard,with_utls,with_acme,with_clash_api,with_tailscale,with_ccm,with_ocm,with_cloudflared,with_naive_outbound,with_purego,badlinkname,tfogo_checklinkname0'
$ldflags = '-X internal/godebug.defaultGODEBUG=multipathtcp=0 -checklinkname=0'

$env:GOOS = 'windows'
$env:GOARCH = 'amd64'
$env:CGO_ENABLED = '0'

New-Item -ItemType Directory -Force -Path .\dist\windows-amd64 | Out-Null

go build -trimpath `
  -tags "$windowsTags" `
  -ldflags "$ldflags" `
  -o .\dist\windows-amd64\sing-box.exe `
  .\cmd\sing-box
```

Результат:

```text
.\dist\windows-amd64\sing-box.exe
```

## libcronet.dll для Windows naive

Для запуска `naive` на Windows рядом с `sing-box.exe` должен лежать:

```text
libcronet.dll
```

или он должен быть доступен через `PATH`.

Итоговая папка обычно такая:

```text
sing-box.exe
config.json
libcronet.dll
```

## Проверка naive на Windows

### Проверка конфига

```powershell
.\sing-box.exe check -c .\config.json
$LASTEXITCODE
```

Если `$LASTEXITCODE = 0`, конфиг валиден.

### Реальная проверка трафика

Запуск:

```powershell
.\sing-box.exe run -c .\config.json
```

В другом окне PowerShell:

```powershell
curl.exe -x socks5h://127.0.0.1:1080 https://api.ipify.org
curl.exe -x http://127.0.0.1:1080 https://api.ipify.org
```

Если возвращается IP сервера, значит:

- `naive` работает
- локальный `mixed` inbound работает
- есть реальный контакт с сервером

## Подводные камни

- Oracle JDK 17 **подошёл** после ослабления проверки версии Java в `main.go`
- если снова появится `java version should be openjdk 17`, значит в `main.go` не тот файл
- если снова появится `-libname` или `-buildvcs`, значит в `main.go` осталась старая версия
- если bindings и `.so` из разных сборок, приложение падает на JNI
- релизные `apk` / `tar.gz` не использовать как замену текущему комплекту bindings + JNI
- если снова появится ошибка вида `golang.org/x/mobile/bind is not found`, временно убрать `vendor`

## Если мешает vendor

Временно убрать:

```powershell
Rename-Item .\vendor vendor.off
```

После сборки вернуть:

```powershell
Rename-Item .\vendor.off vendor
```

## Коротко по рабочей схеме

1. Заменить `cmd/internal/build_libbox/main.go`
2. Выставить `JAVA_HOME`, `ANDROID_HOME`, `ANDROID_NDK_HOME`
3. Установить `gomobile` и `gobind`
4. При необходимости временно убрать `vendor`
5. `gomobile init -ndk ...`
6. `go run .\cmd\internal\build_libbox -target android`
7. Забрать `go/*`, `io/nekohasekai/libbox/*`, `libgojni.so` x4
8. При необходимости отдельно собрать `sing-box.exe` для Windows x64
9. Положить рядом `libcronet.dll`
10. Проверить `naive` через `run + curl`
