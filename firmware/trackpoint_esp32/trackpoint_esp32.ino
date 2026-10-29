#include <WiFi.h>
#include <HTTPClient.h>
#include <TinyGPSPlus.h>
#include <time.h>
#include <math.h>

#define GPS_RX 16
#define GPS_TX 17
#define GPS_BAUD 9600
#define UPLOAD_INTERVAL_MS 5000
#define WIFI_RETRY_INTERVAL_MS 10000
#define POSITION_LOG_INTERVAL_MS 60000

const double GPS_CHANGE_THRESHOLD_M = 5.0;

const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* API_BASE_URL = "https://adc-1k7j.onrender.com";
const char* DEVICE_ID = "A1D2C3";
const char* DEVICE_TOKEN = "YOUR_DEVICE_TOKEN";

TinyGPSPlus gps;
HardwareSerial gpsSerial(2);

unsigned long lastUpload = 0;
unsigned long lastWifiAttempt = 0;
unsigned long lastNoDataMessage = 0;
unsigned long lastPositionLog = 0;

bool wifiStatusKnown = false;
bool lastWifiConnected = false;

bool gpsStatusKnown = false;
bool lastGpsFix = false;

bool noGpsDataWarningPrinted = false;
bool timeSyncWarningPrinted = false;
bool hasLoggedPosition = false;

double lastLoggedLat = 0;
double lastLoggedLng = 0;

int lastHttpStatusCode = -999;

double distanceMetersBetween(double lat1, double lon1, double lat2, double lon2) {
  const double radians = 0.017453292519943295;

  double dLat = (lat2 - lat1) * radians;
  double dLon = (lon2 - lon1) * radians;

  double a =
      sin(dLat / 2) * sin(dLat / 2) +
      cos(lat1 * radians) * cos(lat2 * radians) *
      sin(dLon / 2) * sin(dLon / 2);

  if (a > 1.0) a = 1.0;

  return 6371000.0 * 2.0 * atan2(sqrt(a), sqrt(1.0 - a));
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  if (millis() - lastWifiAttempt < WIFI_RETRY_INTERVAL_MS) return;

  lastWifiAttempt = millis();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
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
    if (!timeSyncWarningPrinted) {
      Serial.println("Waiting for synchronized time before uploading GPS data.");
      timeSyncWarningPrinted = true;
    }
    return false;
  }

  timeSyncWarningPrinted = false;

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

  // Print the result only when the HTTP status changes.
  if (statusCode != lastHttpStatusCode) {
    Serial.print("Telemetry HTTP status changed: ");
    Serial.println(statusCode);

    if (statusCode >= 200 && statusCode < 300) {
      Serial.println("Telemetry upload accepted.");
    } else if (response.length()) {
      Serial.println(response);
    }

    lastHttpStatusCode = statusCode;
  }

  return statusCode >= 200 && statusCode < 300;
}

void setup() {
  Serial.begin(115200);
  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX, GPS_TX);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  lastWifiAttempt = millis();

  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  Serial.println("TrackPoint GPS tracker started.");
}

void loop() {
  while (gpsSerial.available()) {
    gps.encode(gpsSerial.read());
  }

  connectWiFi();

  // Report Wi-Fi only when its connected state changes.
  bool wifiConnected = (WiFi.status() == WL_CONNECTED);

  if (!wifiStatusKnown || wifiConnected != lastWifiConnected) {
    if (wifiConnected) {
      Serial.print("Wi-Fi connected. IP: ");
      Serial.println(WiFi.localIP());
    } else {
      Serial.println("Wi-Fi not connected.");
    }

    lastWifiConnected = wifiConnected;
    wifiStatusKnown = true;
  }

  bool hasFreshFix =
      gps.location.isValid() && gps.location.age() <= 5000;

  // Report GPS fix status only when it changes.
  if (!gpsStatusKnown || hasFreshFix != lastGpsFix) {
    if (hasFreshFix) {
      Serial.println("GPS fix acquired.");
    } else {
      Serial.println("GPS fix unavailable.");
    }

    lastGpsFix = hasFreshFix;
    gpsStatusKnown = true;
  }

  // Print coordinates when moved at least 5 metres, or once per minute.
  if (hasFreshFix) {
    double latitude = gps.location.lat();
    double longitude = gps.location.lng();

    bool moved = !hasLoggedPosition ||
        distanceMetersBetween(
            lastLoggedLat, lastLoggedLng, latitude, longitude
        ) >= GPS_CHANGE_THRESHOLD_M;

    bool minutePassed = !hasLoggedPosition ||
        millis() - lastPositionLog >= POSITION_LOG_INTERVAL_MS;

    if (moved || minutePassed) {
      Serial.print("GPS position: ");
      Serial.print(latitude, 7);
      Serial.print(", ");
      Serial.println(longitude, 7);

      lastLoggedLat = latitude;
      lastLoggedLng = longitude;
      lastPositionLog = millis();
      hasLoggedPosition = true;
    }
  }

  // Keep uploading every five seconds while a fresh GPS fix is available.
  if (millis() - lastUpload >= UPLOAD_INTERVAL_MS) {
    lastUpload = millis();

    if (hasFreshFix) {
      postLocation();
    }
  }

  // Report missing GPS serial data once, rather than repeatedly.
  if (millis() > 10000 &&
      gps.charsProcessed() < 10 &&
      !noGpsDataWarningPrinted &&
      millis() - lastNoDataMessage > 10000) {
    lastNoDataMessage = millis();
    noGpsDataWarningPrinted = true;
    Serial.println(
        "No data from GPS. Check power, baud rate, and crossed TX/RX wiring."
    );
  } else if (gps.charsProcessed() >= 10 && noGpsDataWarningPrinted) {
    noGpsDataWarningPrinted = false;
    Serial.println("GPS serial data detected.");
  }
}