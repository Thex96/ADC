#include <WiFi.h>
#include <HTTPClient.h>
#include <TinyGPSPlus.h>
#include <time.h>

#define GPS_RX 16
#define GPS_TX 17
#define GPS_BAUD 9600
#define UPLOAD_INTERVAL_MS 5000
#define WIFI_RETRY_INTERVAL_MS 10000

const char* WIFI_SSID = "Theodore";
const char* WIFI_PASSWORD = "12345678";
const char* API_BASE_URL = "http://localhost:5000/api";
const char* DEVICE_ID = "A1D2C3";
const char* DEVICE_TOKEN = "31ce8e15a3f143a194b6a4556072a953119537043df3f218306362a995e3dc14";

TinyGPSPlus gps;
HardwareSerial gpsSerial(2);

unsigned long lastUpload = 0;
unsigned long lastWifiAttempt = 0;
unsigned long lastNoDataMessage = 0;

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  if (millis() - lastWifiAttempt < WIFI_RETRY_INTERVAL_MS) return;

  lastWifiAttempt = millis();
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.println("Connecting to Wi-Fi...");
}

String isoTimestamp() {
  struct tm timeInfo;
  if (!getLocalTime(&timeInfo, 100)) return "";

  char buffer[25];
  strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", &timeInfo);
  return String(buffer);
}

bool postLocation() {
  if (WiFi.status() != WL_CONNECTED) return false;
  if (!gps.location.isValid() || gps.location.age() > 5000) return false;

  String fixAt = isoTimestamp();
  if (!fixAt.length()) {
    Serial.println("Waiting for synchronized time before uploading GPS data.");
    return false;
  }

  HTTPClient http;
  String url = String(API_BASE_URL) + "/telemetry/" + DEVICE_ID;

  http.begin(url);
  http.setTimeout(5000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-token", DEVICE_TOKEN);

  String payload = "{";
  payload += "\"latitude\":" + String(gps.location.lat(), 8);
  payload += ",\"longitude\":" + String(gps.location.lng(), 8);

  if (gps.speed.isValid()) {
    payload += ",\"speedKmph\":" + String(gps.speed.kmph(), 2);
  }
  if (gps.altitude.isValid()) {
    payload += ",\"altitudeM\":" + String(gps.altitude.meters(), 2);
  }
  if (gps.satellites.isValid()) {
    payload += ",\"satellites\":" + String(gps.satellites.value());
  }
  if (gps.hdop.isValid()) {
    payload += ",\"hdop\":" + String(gps.hdop.hdop(), 2);
  }

  payload += ",\"fixAt\":\"" + fixAt + "\"";
  payload += "}";

  int statusCode = http.POST(payload);
  String response = http.getString();
  http.end();

  Serial.print("Telemetry HTTP status: ");
  Serial.println(statusCode);

  if (statusCode < 200 || statusCode >= 300) {
    Serial.println(response);
    return false;
  }

  Serial.println("GPS telemetry uploaded.");
  return true;
}

void setup() {
  Serial.begin(115200);
  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX, GPS_TX);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  Serial.println("TrackPoint GPS tracker started.");
}

void loop() {
  while (gpsSerial.available()) {
    gps.encode(gpsSerial.read());
  }

  connectWiFi();

  if (millis() - lastUpload >= UPLOAD_INTERVAL_MS) {
    lastUpload = millis();

    if (gps.location.isValid() && gps.location.age() <= 5000) {
      Serial.print("Lat: ");
      Serial.print(gps.location.lat(), 7);
      Serial.print(" | Lng: ");
      Serial.print(gps.location.lng(), 7);
      Serial.print(" | Sats: ");

      if (gps.satellites.isValid()) {
        Serial.print(gps.satellites.value());
      } else {
        Serial.print("unavailable");
      }

      Serial.print(" | HDOP: ");
      if (gps.hdop.isValid()) {
        Serial.print(gps.hdop.hdop(), 2);
      } else {
        Serial.print("unavailable");
      }

      Serial.print(" | Speed: ");
      if (gps.speed.isValid()) {
        Serial.print(gps.speed.kmph(), 1);
        Serial.print(" km/h");
      } else {
        Serial.print("unavailable");
      }

      Serial.print(" | Alt: ");
      if (gps.altitude.isValid()) {
        Serial.print(gps.altitude.meters(), 1);
        Serial.println(" m");
      } else {
        Serial.println("unavailable");
      }

      postLocation();
    } else {
      Serial.print("Waiting for a fresh GPS fix. Satellites: ");
      Serial.println(
        gps.satellites.isValid() ? gps.satellites.value() : 0
      );
    }
  }

  if (millis() > 10000 &&
      gps.charsProcessed() < 10 &&
      millis() - lastNoDataMessage > 10000) {
    lastNoDataMessage = millis();
    Serial.println(
      "No data from GPS. Check power, baud rate, and crossed TX/RX wiring."
    );
  }
}