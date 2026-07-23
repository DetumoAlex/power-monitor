/*
  02_wifi_connect_test.ino

  CHECKPOINT 2 — prove the board can talk to your network.
  Still no sensors, no backend calls yet — just connect and print.

  Fill in your WiFi credentials below before uploading. Do not commit
  this file with real credentials to any public repo later — when this
  becomes a real project, move these into a gitignored config header.

  Success = Serial Monitor (115200 baud) prints "WiFi connected" and
  shows an IP address.
*/

#include <WiFi.h>

const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

void setup() {
  Serial.begin(115200);
  delay(1000);

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
    Serial.println();
    Serial.println("WiFi connected");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("WiFi connection FAILED after 15 seconds.");
    Serial.println("Check SSID/password, and that you're on 2.4GHz (ESP32 does not support 5GHz WiFi).");
  }
}

void loop() {
  // Nothing here yet — checkpoint 2 is just about connecting once.
}
