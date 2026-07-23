/*
  01_blink_led.ino

  CHECKPOINT 1 — prove you can get code onto the board at all.
  No WiFi, no sensors, no external components required beyond the
  board itself (uses the onboard LED most ESP32 dev boards have on
  GPIO 2 — if yours doesn't blink, try GPIO 5 or check your board's
  pinout diagram, they vary by manufacturer).

  Success = the onboard LED blinks once per second.

  If this doesn't work, the problem is almost certainly one of:
  - Wrong board selected in Arduino IDE (Tools > Board)
  - Wrong COM/serial port selected (Tools > Port)
  - USB cable is charge-only, not data (very common failure, try a
    different cable before assuming it's a code or board problem)
*/

#define LED_PIN 2  // change to 5 if your board's LED doesn't respond

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
  Serial.println("Checkpoint 1: blink test starting");
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(1000);
  digitalWrite(LED_PIN, LOW);
  delay(1000);
}
