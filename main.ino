#include <WiFi.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ESP32Servo.h>

#include "Adafruit_MQTT.h"
#include "Adafruit_MQTT_Client.h"

// =======================================================
// 1) USER SETTINGS (CHANGE THESE LATER AS NEEDED)
// =======================================================

// ---------- WiFi ----------   
#define WIFI_SSID     "wifiname here"
#define WIFI_PASS     "wifi pass here"

// ---------- Adafruit IO ----------
#define AIO_SERVER     "io.adafruit.com"
#define AIO_SERVERPORT 1883
#define AIO_USERNAME   "adafruit username here"
#define AIO_KEY        "  adafruit key here"

// ---------- Bin calibration (CHANGE LATER) ----------
// These values depend on YOUR physical bin height and sensor mounting.
#define EMPTY_DIST_CM  30   // distance when bin is empty (cm)
#define FULL_DIST_CM   8    // distance when bin is physically full (cm)

// ---------- FULL logic for dashboard/project (CHANGE LATER) ----------
#define FULL_THRESHOLD_PERCENT 95  // FULL when fillPercent >= 95

// ---------- Servo angles (CHANGE LATER for your cardboard geometry) ----------
#define ANGLE_PLASTIC  30
#define ANGLE_PAPER    90
#define ANGLE_OTHER    150

// =======================================================
// 2) HARDWARE PINS (SINGLE COMPONENT SECTIONS)
// =======================================================

// ---------- Ultrasonic HC-SR04 ----------
const int trigPin = 5;
const int echoPin = 4;

// ---------- OLED I2C (your setup) ----------
const int sdaPin = 8;
const int sclPin = 9;

// ---------- Servo ----------
const int servoPin = 18;

// =======================================================
// 3) OLED SETUP (SINGLE COMPONENT)
// =======================================================
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// =======================================================
// 4) SERVO SETUP (SINGLE COMPONENT)
// =======================================================
Servo sorterServo;

// =======================================================
// 5) MQTT SETUP (SINGLE COMPONENT)
// =======================================================
WiFiClient client;
Adafruit_MQTT_Client mqtt(&client, AIO_SERVER, AIO_SERVERPORT, AIO_USERNAME, AIO_KEY);

// ---------- Publish feeds (ESP32 -> Cloud -> Dashboard) ----------
Adafruit_MQTT_Publish distanceFeed      = Adafruit_MQTT_Publish(&mqtt, AIO_USERNAME "/feeds/distance");
Adafruit_MQTT_Publish fillPercentFeed   = Adafruit_MQTT_Publish(&mqtt, AIO_USERNAME "/feeds/fill_percent");
Adafruit_MQTT_Publish binFullFeed       = Adafruit_MQTT_Publish(&mqtt, AIO_USERNAME "/feeds/bin_full");

// NEW: sensor ok (for WARNING logic on dashboard)
Adafruit_MQTT_Publish sensorOkFeed      = Adafruit_MQTT_Publish(&mqtt, AIO_USERNAME "/feeds/sensor_ok");

// ---------- Subscribe feeds (Dashboard -> Cloud -> ESP32) ----------
Adafruit_MQTT_Subscribe targetBinSub    = Adafruit_MQTT_Subscribe(&mqtt, AIO_USERNAME "/feeds/target_bin");
Adafruit_MQTT_Subscribe wasteTypeSub    = Adafruit_MQTT_Subscribe(&mqtt, AIO_USERNAME "/feeds/waste_type");

// =======================================================
// 6) STATE VARIABLES
// =======================================================
long lastPublishMs = 0;

// IMPORTANT: professor + dashboard requirement
// Publish/refresh cycle = every 20 seconds
const long PUBLISH_EVERY_MS = 20000;   // ✅ 20 seconds

int distanceCM = -1;
int fillPercent = 0;

// FULL is now based on percent >= 95
bool binFull = false;

// sensor health (used for WARNING state)
bool sensorOk = true;

String wasteType = "none";   // plastic/paper/other
int targetBin = 0;           // 1=plastic, 2=paper, 3=other

// =======================================================
// 7) NETWORK HELPERS
// =======================================================
void connectWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi connected!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
}

void MQTT_connect() {
  if (mqtt.connected()) return;

  Serial.print("Connecting to MQTT... ");
  uint8_t retries = 5;
  int8_t ret;

  while ((ret = mqtt.connect()) != 0) {
    Serial.println(mqtt.connectErrorString(ret));
    Serial.println("Retrying MQTT in 2 seconds...");
    mqtt.disconnect();
    delay(2000);

    if (--retries == 0) {
      Serial.println("MQTT failed. Restarting...");
      ESP.restart();
    }
  }

  Serial.println("MQTT Connected!");
}

// =======================================================
// 8) ULTRASONIC SENSOR FUNCTIONS (SINGLE COMPONENT)
// =======================================================
int readDistanceCM() {
  // Trigger pulse
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  // Read echo pulse (timeout 30ms)
  long duration = pulseIn(echoPin, HIGH, 30000);
  if (duration == 0) return -1;  // no echo

  // Convert to cm
  int cm = (int)(duration * 0.034 / 2);

  // sanity clamp
  if (cm < 2 || cm > 400) return -1;

  return cm;
}

// Convert distance -> fullness %
// CHANGE LATER: EMPTY_DIST_CM and FULL_DIST_CM after calibration
int calculateFillPercent(int dist) {
  if (dist < 0) return 0;            // unknown reading -> treat as 0 for now
  if (dist >= EMPTY_DIST_CM) return 0;
  if (dist <= FULL_DIST_CM)  return 100;

  // Map dist from [EMPTY..FULL] to [0..100]
  return map(dist, EMPTY_DIST_CM, FULL_DIST_CM, 0, 100);
}

// FULL logic: based on percent (your requirement)
bool isBinFullByPercent(int percent) {
  return percent >= FULL_THRESHOLD_PERCENT; // ✅ FULL at 95%
}

// =======================================================
// 9) SERVO CONTROL (SINGLE COMPONENT)
// =======================================================
void moveServoToBin(int bin) {
  // Safety: don’t sort when full
  if (binFull) return;

  int angle = ANGLE_OTHER;
  if (bin == 1) angle = ANGLE_PLASTIC;
  else if (bin == 2) angle = ANGLE_PAPER;
  else if (bin == 3) angle = ANGLE_OTHER;

  sorterServo.write(angle);
}

// =======================================================
// 10) OLED DISPLAY (SINGLE COMPONENT)
// =======================================================
void updateOLED() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print("SMART BIN");

  display.setCursor(0, 12);
  display.print("Type: ");
  display.print(wasteType);

  display.setCursor(0, 24);
  display.print("Dist: ");
  if (distanceCM >= 0) {
    display.print(distanceCM);
    display.print(" cm");
  } else {
    display.print("NO ECHO");
  }

  display.setCursor(0, 36);
  display.print("Fill: ");
  display.print(fillPercent);
  display.print("%");

  display.setCursor(0, 48);
  display.print("Status: ");
  if (!sensorOk) display.print("WARN");
  else display.print(binFull ? "FULL" : "OK");

  display.display();
}

// =======================================================
// 11) SETUP
// =======================================================
void setup() {
  Serial.begin(115200);

  // Ultrasonic pins
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);

  // OLED I2C
  Wire.begin(sdaPin, sclPin);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED init failed (try 0x3D if needed)");
    while (true) delay(10);
  }
  display.clearDisplay();
  display.setTextColor(WHITE);

  // Servo
  sorterServo.attach(servoPin);
  sorterServo.write(ANGLE_PAPER); // neutral start (CHANGE LATER if needed)

  // WiFi + MQTT
  connectWiFi();
  mqtt.subscribe(&targetBinSub);
  mqtt.subscribe(&wasteTypeSub);

  updateOLED();
}

// =======================================================
// 12) MAIN LOOP
// =======================================================
void loop() {
  MQTT_connect();

  // ---- Read incoming commands from dashboard ----
  Adafruit_MQTT_Subscribe *subscription;
  while ((subscription = mqtt.readSubscription(10))) {

    // target_bin expects 1/2/3 from dashboard
    if (subscription == &targetBinSub) {
      targetBin = atoi((char *)targetBinSub.lastread);
      Serial.print("RX target_bin = ");
      Serial.println(targetBin);

      // ACTION: move servo (sorting)
      moveServoToBin(targetBin);
    }

    // waste_type expects plastic/paper/other
    if (subscription == &wasteTypeSub) {
      wasteType = String((char *)wasteTypeSub.lastread);
      wasteType.trim();
      Serial.print("RX waste_type = ");
      Serial.println(wasteType);
    }
  }

  mqtt.ping();

  // ---- Read sensors (we still read frequently, but only PUBLISH every 20s) ----
  distanceCM = readDistanceCM();
  sensorOk = (distanceCM >= 0);          // WARNING when NO ECHO / invalid data
  fillPercent = calculateFillPercent(distanceCM);
  binFull = sensorOk && isBinFullByPercent(fillPercent);

  // Update OLED continuously
  updateOLED();

  // ---- Publish (every 20 seconds) ----
  if (millis() - lastPublishMs > PUBLISH_EVERY_MS) {
    lastPublishMs = millis();

    Serial.print("Publishing dist=");
    Serial.print(distanceCM);
    Serial.print(" fill=");
    Serial.print(fillPercent);
    Serial.print(" full=");
    Serial.print(binFull ? 1 : 0);
    Serial.print(" sensor_ok=");
    Serial.println(sensorOk ? 1 : 0);

    distanceFeed.publish((int32_t)distanceCM);               // -1 indicates invalid
    fillPercentFeed.publish((int32_t)fillPercent);
    binFullFeed.publish((int32_t)(binFull ? 1 : 0));
    sensorOkFeed.publish((int32_t)(sensorOk ? 1 : 0));
  }

  delay(200);
}
