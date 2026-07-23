# Firmware — Phase 0 Setup

Three checkpoints, in order. Do not skip ahead — each one isolates a
different failure point, and skipping means you won't know which layer
broke if something doesn't work.

## One-time Arduino IDE setup

1. Install Arduino IDE (2.x) if you don't have it.
2. File > Preferences > "Additional Board Manager URLs", add:
   `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
3. Tools > Board > Boards Manager, search "esp32", install the
   Espressif package (this can take a while, it's a large download).
4. Plug in your board. Tools > Board, select your specific board (if
   unsure, "ESP32 Dev Module" is a safe generic default).
5. Tools > Port, select the port that appeared when you plugged in —
   if nothing appears, that's almost always the "charge-only cable"
   problem, try a different USB cable before anything else.

## Checkpoint sequence

### 1. `01_blink_led/`
No WiFi, no components beyond the board. Just proves you can upload
code and it runs. Open the `.ino`, hit Upload, watch for the onboard
LED blinking once per second.

**Don't move on until this works.** If it doesn't, the problem is
almost always board selection, port selection, or the USB cable —
not your code.

### 2. `02_wifi_connect_test/`
Fill in your WiFi SSID/password at the top of the file. Upload, then
open Serial Monitor (Tools > Serial Monitor, set baud rate to 115200
in the dropdown at the bottom-right — if you see garbled text, this
is almost always a baud-rate mismatch). You should see "WiFi
connected" and an IP address.

**Common failure**: ESP32 only supports 2.4GHz WiFi, not 5GHz. If your
router broadcasts both under the same name, this will fail silently —
either split the bands in your router settings, or connect to a phone
hotspot set to 2.4GHz to rule this out as the problem.

### 3. `03_post_event_to_backend/`
Needs a breadboard + pushbutton (from your original component list) —
see the wiring instructions in the file's header comment. Also needs
your backend server (`node src/index.js` from the main project)
running and reachable on the same WiFi network as the ESP32.

Fill in WiFi credentials, `API_HOST` (your computer's local IP, not
"localhost" — the ESP32 doesn't know what "localhost" means for a
different machine), and `DEVICE_ID`.

**This is the actual Phase 0 completion checkpoint.** Success means:
pressing the button prints a successful POST response in Serial
Monitor, and afterward you can run
`curl http://<your-backend>:3000/events/<DEVICE_ID>/current`
and see the status you just triggered.

Once this works, Phase 0 is genuinely done — you've proven the full
chain (device -> WiFi -> backend -> database -> queryable result)
works end to end. Everything after this (Phase 1: GSM + battery,
Phase 2: real sensor via certified relay) is additive to a foundation
that's already proven, not a leap of faith.
