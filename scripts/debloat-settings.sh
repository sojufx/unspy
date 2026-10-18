#!/bin/sh
# debloat-settings.sh  (Stage 1: privacy + store/demo mode)
# Sets only documented LG settings via the settings service. Fully reversible
# from the TV's own menus.

L=/usr/bin/luna-send
G='{"category":"general","keys":["adCookie","doNotSellMyPersonalInformation","sportsAlarm","noSignalGuideArea","welcomeFeature","voiceLongDistance","homePromotion","customizedAd","personalRecommend","aiChannel"]}'
O='{"category":"option","keys":["demoMode","storeMode2","storeMode","webOSPromotionVideo","livePlus","storeHDR","channelplus","promotionStreamer"]}'

echo "########## BEFORE ##########"
$L -n 1 luna://com.webos.settingsservice/getSystemSettings "$G" 2>/dev/null
echo
$L -n 1 luna://com.webos.settingsservice/getSystemSettings "$O" 2>/dev/null
echo

echo "########## APPLY: general ##########"
$L -n 1 luna://com.webos.settingsservice/setSystemSettings \
  '{"category":"general","settings":{"adCookie":"off","doNotSellMyPersonalInformation":"on","sportsAlarm":"off","noSignalGuideArea":"off","welcomeFeature":"off","voiceLongDistance":"off"}}' 2>/dev/null
echo

echo "########## APPLY: option (store/demo mode) ##########"
$L -n 1 luna://com.webos.settingsservice/setSystemSettings \
  '{"category":"option","settings":{"demoMode":"off","storeMode2":"off","webOSPromotionVideo":"off","livePlus":"off","promotionStreamer":"off","channelplus":"off","watchedListCollection":"off"}}' 2>/dev/null
echo

sleep 2
echo "########## AFTER: general ##########"
$L -n 1 luna://com.webos.settingsservice/getSystemSettings "$G" 2>/dev/null
echo
echo "########## AFTER: option ##########"
$L -n 1 luna://com.webos.settingsservice/getSystemSettings "$O" 2>/dev/null
echo
echo "########## DONE ##########"
