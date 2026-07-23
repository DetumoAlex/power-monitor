/*
  03_post_event_to_backend.ino

  CHECKPOINT 3 — prove the full device-to-backend flow works.
  This is what "Phase 0 done" actually means, per ROADMAP.md.

  Uses a pushbutton as a SAFE STAND-IN for the real sensor, which
  won't exist until Phase 2 (via a pre-certified smart relay, never
  raw mains wiring — see ROADMAP.md for why). The button lets you
  simulate ON/OFF transitions by hand, which is exactly what you need
  to prove the rest of the pipeline works before touching anything
  mains-adjacent.

  WIRING (breadboard, no soldering needed):
  - One leg of the pushbutton to GPIO 4
  - The other leg of the pushbutton to GND
  - No external resistor needed — this code uses the ESP32's internal
    pull-up resistor (INPUT_PULLUP), which is why the logic below is
    inverted: pressed = LOW = we treat it as "OFF", released = HIGH =
    "ON". This mirrors how a real presence sensor will likely behave
    (signal present = HIGH = power ON), so the logic you write here is
    close to what you'll reuse in Phase 2-3, not throwaway code.

  Before uploading:
  1. Fill in WIFI_SSID / WIFI_PASSWORD below
  2. Fill in API_HOST with your backend's address — if testing against
     a server running on your own laptop on the same WiFi network, use
     that laptop's local IP (e.g. "192.168.1.42"), NOT "localhost" —
     localhost on the ESP32 means the ESP32 itself, not your laptop.
  3. Fill in DEVICE_ID — must match a value you're prepared to query
     later via GET /events/:deviceId/stats

  Success = pressing/releasing the button prints a successful POST to
  Serial Monitor, and you can confirm the event landed by querying
  GET /events/:deviceId/current from a browser or curl afterward.
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <time.h>

const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* API_HOST = "http://192.168.1.42:3000"; // <-- change to your backend's address
const char* DEVICE_ID = "esp32-checkpoint3-001";     // <-- must be a valid Mongo ObjectId string once you're posting against the real DB

const int BUTTON_PIN = 4;

int lastButtonState = HIGH; // HIGH = released = "ON" (matches INPUT_PULLUP idle state)
unsigned long lastDebounceTime = 0;
const unsigned long DEBOUNCE_MS = 50;

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  connectWiFi();
  syncTime();
}

void loop() {
  int reading = digitalRead(BUTTON_PIN);

  if (reading != lastButtonState) {
    lastDebounceTime = millis();
  }

  if ((millis() - lastDebounceTime) > DEBOUNCE_MS && reading != lastButtonState) {
    lastButtonState = reading;
    // Inverted logic per the wiring comment above:
    // reading == LOW  (pressed)  -> treat as OFF
    // reading == HIGH (released) -> treat as ON
    String status = (reading == LOW) ? "OFF" : "ON";
    Serial.print("Transition detected: ");
    Serial.println(status);
    postEvent(status);
  }
}

void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected. IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\nWiFi FAILED. Check credentials and that you're on 2.4GHz.");
  }
}

void syncTime() {
  // NTP sync so event timestamps are real wall-clock time, not just
  // "seconds since boot". GMT+1 for Nigeria (WAT), no DST offset.
  configTime(3600, 0, "pool.ntp.org", "time.nist.gov");
  Serial.println("Waiting for NTP time sync...");
  time_t now = time(nullptr);
  int attempts = 0;
  while (now < 100000 && attempts < 20) { // arbitrary "clearly not synced yet" threshold
    delay(500);
    now = time(nullptr);
    attempts++;
  }
  Serial.println(now >= 100000 ? "Time synced." : "Time sync FAILED — timestamps will be wrong.");
}

String getIsoTimestamp() {
  time_t now = time(nullptr);
  struct tm timeinfo;
  gmtime_r(&now, &timeinfo);
  char buf[25];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buf);
}

void postEvent(String status) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Cannot post — WiFi not connected.");
    return;
  }

  HTTPClient http;
  String url = String(API_HOST) + "/events";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  String payload = "{\"deviceId\":\"" + String(DEVICE_ID) +
                    "\",\"status\":\"" + status +
                    "\",\"timestamp\":\"" + getIsoTimestamp() + "\"}";

  int httpCode = http.POST(payload);

  if (httpCode > 0) {
    Serial.printf("POST response: %d\n", httpCode);
    Serial.println(http.getString());
  } else {
    Serial.printf("POST failed: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}
