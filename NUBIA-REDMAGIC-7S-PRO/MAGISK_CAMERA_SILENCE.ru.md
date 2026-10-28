# REDMAGIC NX709S — Magisk-модуль отключения звука камеры

**Дата:** 28 октября 2026 г.  
**Модуль:** `REDMAGIC-Camera-Silence-Magisk-v1.0.zip`  
**ID:** `redmagic_camera_silence`  
**Устройство тестирования:** REDMAGIC NX709S, Android 13, Magisk 28102.

## Для чего это нужно

Модуль создаёт бесшумную подмену ресурса `camera_click.ogg` по двум системным путям:
- `/system/media/audio/ui/camera_click.ogg`;
- `/product/media/audio/ui/camera_click.ogg`.

В ZIP второй ресурс лежит по пути `system/product/media/audio/ui/camera_click.ogg` — это стандартная структура systemless-модуля Magisk.

**Оригинальные разделы не прошиваются и не изменяются.** При загрузке Magisk подключает подмену поверх штатных файлов. Это важно для устройств с AVB/dm-verity.

## Установка

1. Убедитесь, что Magisk установлен и телефон полностью загружен.
2. Скопируйте ZIP на телефон, откройте приложение **Magisk → Модули → Установить из хранилища** и выберите `REDMAGIC-Camera-Silence-Magisk-v1.0.zip`.
3. Дождитесь завершения установки, перезагрузите телефон.
4. Откройте Telegram и проверьте снимок камерой.

**Важно:** проверка отсутствия звука в Telegram выполнена пользователем на прежнем модуле с теми же путями подмены. ZIP v1.0 содержит валидный бесшумный Ogg Vorbis 48 кГц, mono, 0,35 секунды, размер **9943 байта**. Отдельный результат проверки Telegram после установки этого ZIP нужно записать только после личной проверки.

## Удаление и возврат оригинального звука

В **Magisk → Модули** найдите **REDMAGIC Camera Silence**, нажмите «Удалить» и перезагрузите телефон. Оригинальные файлы автоматически станут видимыми снова. **Не удаляйте Magisk целиком:** достаточно удалить именно этот модуль.

Если приложение Magisk недоступно, имея рабочий root-доступ через ADB и подтверждённый серийный номер устройства, можно пометить модуль на удаление:

```powershell
$adb = 'C:\Users\User\AppData\Local\Android\Sdk\platform-tools\adb.exe'
& $adb -s 91809037 shell su -c 'touch /data/adb/modules/redmagic_camera_silence/remove'
& $adb -s 91809037 reboot
```

Не запускайте команду на другом телефоне без уточнения его серийного номера.

## Проверки и контрольные суммы

- ZIP SHA-256: `1a62131f9e863ec4011eab7399586ce4bb397e3cee5c723d90d1a1e91110f711`.
- Бесшумный Ogg SHA-256: `521fbc8a38fd1ab337a3b3d567f4760c3b57072a10debe5ec2e9cae420f8f373`.
- Оригинальный Ogg SHA-256: `7be37e7e3de8e6d15e8a1b7e67fed575354bfee9473af6062e746de059a76e67`.

После установки и перезагрузки при наличии root:

```powershell
& $adb -s 91809037 shell getprop sys.boot_completed
& $adb -s 91809037 shell su -c 'magisk -V'
& $adb -s 91809037 shell su -c 'sha256sum /system/media/audio/ui/camera_click.ogg /product/media/audio/ui/camera_click.ogg'
```

Оба видимых Ogg должны иметь SHA-256 бесшумного файла. После удаления и перезагрузки — SHA-256 оригинала.

## Воспроизведение ZIP

Архив содержит ровно три записи: `module.prop`, `system/media/audio/ui/camera_click.ogg`, `system/product/media/audio/ui/camera_click.ogg`. Это стандартный ZIP, без скриптов прошивки и без операций с физическими разделами. При повторной упаковке сохраняйте эти пути и `id=redmagic_camera_silence`.

## Состояние установки

На телефоне установлен Magisk 28102, root доступен. ZIP v1.0 установлен командой `magisk --install-module`, установка завершилась сообщением `Done`; инициирована перезагрузка. Результат последующей проверки загрузки и хешей см. в обновлении записи при наличии подтверждения.

## Проверено после установки (28.10.2026)

Телефон перезагрузился, sys.boot_completed=1. У обоих системных camera_click.ogg SHA-256 521fbc8a38fd1ab337a3b3d567f4760c3b57072a10debe5ec2e9cae420f8f373 — подмена работает. Модуль edmagic_camera_silence присутствует рядом с ранее установленным com.google.android.youtube-morphe. Фактический результат звука в интерфейсе Telegram для v1.0 отдельно пользователем пока не проверен.
