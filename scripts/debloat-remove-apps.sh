#!/bin/sh
# debloat-remove-apps.sh - uninstalls the approved promo/junk user apps.
# Reversible: every one of these can be reinstalled from the LG Content Store.

L=/usr/bin/luna-send
APPS="webos.day com.lgshop.app35 com.lgtravel.app com.twin.app.audiochannel epoxyaisports com.lgtvod.app com.miniclip.eightballpool"

for a in $APPS; do
  printf "removing %-32s " "$a"
  $L -n 1 luna://com.webos.appInstallService/remove "{\"id\":\"$a\"}" 2>/dev/null
  echo
  sleep 1
done

echo
echo "########## VERIFY: any of the 7 still installed? ##########"
$L -n 1 luna://com.webos.applicationManager/listApps '{}' 2>/dev/null \
  | tr ',' '\n' \
  | grep -E '"id":"(webos.day|com.lgshop.app35|com.lgtravel.app|com.twin.app.audiochannel|epoxyaisports|com.lgtvod.app|com.miniclip.eightballpool)"' \
  || echo "  (none of the 7 remain - all removed)"
echo
echo "########## VERIFY: streaming apps still present ##########"
$L -n 1 luna://com.webos.applicationManager/listApps '{}' 2>/dev/null \
  | tr ',' '\n' \
  | grep -E '"id":"(netflix|amazon|com.disney.disneyplus-prod|com.apple.appletv|bbc.iplayer.3.0|org.webosbrew.hbchannel)"' || true
echo "########## DONE ##########"
