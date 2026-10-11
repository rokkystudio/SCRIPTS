# REDMAGIC 7S Pro: удаление и восстановление боковой панели Entertainment Toolbox

Руководство описывает управление системной боковой панелью REDMAGIC, которая отображается маленькой полоской сбоку экрана и открывает инструменты вроде GIF, Super Snap, записи экрана и проекции экрана.

Пакет панели:

```text
cn.nubia.entertainmenttoolbox
```

## Требования

- REDMAGIC 7S Pro или совместимое устройство Nubia/REDMAGIC.
- Root-доступ через Magisk или другой `su`-провайдер.
- Доступ к shell на телефоне: локальный терминал, ADB shell или MYMCP.

Проверка root-доступа:

```sh
su -c 'id'
```

Ожидаемый результат содержит `uid=0(root)`:

```text
uid=0(root) gid=0(root)
```

## Проверка текущего состояния панели

Проверить, установлен ли пакет для текущего пользователя:

```sh
su -c 'pm list packages | grep cn.nubia.entertainmenttoolbox || true'
```

Проверить, отключён ли пакет:

```sh
su -c 'pm list packages -d | grep cn.nubia.entertainmenttoolbox || true'
```

Проверить, запущен ли процесс панели:

```sh
su -c 'ps -A | grep -i entertainmenttoolbox || true'
```

Проверить, есть ли активное окно боковой полоски:

```sh
su -c 'dumpsys window windows | grep -i -A4 -B2 "FloatBar\|entertainmenttoolbox" || true'
```

Проверить право рисовать поверх экрана:

```sh
su -c 'appops get cn.nubia.entertainmenttoolbox SYSTEM_ALERT_WINDOW || true'
```

## Временное отключение панели

Этот способ отключает пакет для текущего пользователя и запрещает ему рисовать поверх экрана.

```sh
su -c '
pm disable-user --user 0 cn.nubia.entertainmenttoolbox
appops set cn.nubia.entertainmenttoolbox SYSTEM_ALERT_WINDOW deny
am force-stop cn.nubia.entertainmenttoolbox
killall cn.nubia.entertainmenttoolbox 2>/dev/null || true
'
```

После выполнения проверь, исчезла ли полоска:

```sh
su -c 'dumpsys window windows | grep -i -A4 -B2 "FloatBar\|entertainmenttoolbox" || true'
```

Если вывод пустой, активного окна панели нет.

## Полное удаление панели для текущего пользователя

Этот способ удаляет системный пакет только для пользователя `0`. APK остаётся в системном разделе, поэтому панель можно восстановить командой `install-existing`.

```sh
su -c '
am force-stop cn.nubia.entertainmenttoolbox
pm uninstall --user 0 cn.nubia.entertainmenttoolbox
for p in $(pidof cn.nubia.entertainmenttoolbox 2>/dev/null); do kill -9 $p; done
'
```

Проверить результат:

```sh
su -c '
echo INSTALLED
pm list packages | grep -i cn.nubia.entertainmenttoolbox || true

echo PROCESS
ps -A | grep -i entertainmenttoolbox || true

echo WINDOWS
dumpsys window windows | grep -i -A4 -B2 "FloatBar\|entertainmenttoolbox" || true
'
```

Ожидаемый результат: после строк `INSTALLED`, `PROCESS` и `WINDOWS` нет записей про `cn.nubia.entertainmenttoolbox` или `FloatBar`.

## Восстановление панели

Вернуть системный пакет для текущего пользователя:

```sh
su -c 'cmd package install-existing --user 0 cn.nubia.entertainmenttoolbox'
```

Вернуть право рисовать поверх экрана:

```sh
su -c 'appops set cn.nubia.entertainmenttoolbox SYSTEM_ALERT_WINDOW allow'
```

Запустить пакет:

```sh
su -c 'monkey -p cn.nubia.entertainmenttoolbox 1'
```

Если панель не появилась сразу, перезагрузи телефон:

```sh
su -c 'reboot'
```

## Быстрая команда восстановления

```sh
su -c 'cmd package install-existing --user 0 cn.nubia.entertainmenttoolbox && appops set cn.nubia.entertainmenttoolbox SYSTEM_ALERT_WINDOW allow'
```

После восстановления перезагрузка помогает системе заново поднять сервисы панели:

```sh
su -c 'reboot'
```

## Быстрая команда удаления

```sh
su -c '
am force-stop cn.nubia.entertainmenttoolbox
appops set cn.nubia.entertainmenttoolbox SYSTEM_ALERT_WINDOW deny
pm uninstall --user 0 cn.nubia.entertainmenttoolbox
for p in $(pidof cn.nubia.entertainmenttoolbox 2>/dev/null); do kill -9 $p; done
'
```

## Диагностика, если полоска вернулась

Проверить, кто рисует боковую полоску:

```sh
su -c 'dumpsys window windows | grep -i -A8 -B4 "FloatBar\|APPLICATION_OVERLAY\|DISPLAY_OVERLAY\|entertainmenttoolbox\|gameassist"'
```

Если в выводе снова есть `FloatBar` и `package=cn.nubia.entertainmenttoolbox`, повтори удаление для текущего пользователя.

Если в выводе указан другой пакет, отключение нужно выполнять для найденного пакета, а не для `cn.nubia.entertainmenttoolbox`.

## Важные замечания

- `pm uninstall --user 0` не удаляет APK из системного раздела. Команда удаляет приложение только для текущего пользователя Android.
- `cmd package install-existing --user 0` возвращает приложение, если оно всё ещё существует в системном разделе.
- Запрет `SYSTEM_ALERT_WINDOW` мешает приложению показывать плавающую панель поверх других окон.
- После отключения или восстановления системных компонентов перезагрузка делает состояние стабильным.
