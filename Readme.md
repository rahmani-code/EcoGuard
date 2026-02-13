# 🗑️ EcoGuard - Smart Waste Sorting System

**An inteligent Trashbin for waste management built for automated sorting and real-time monitoring.**

---

## 🎯 Overview

EcoGuard is a smart bin that uses ultrasonic sensors to monitor fill levels and servo motors to automatically sort waste into three categories: **Plastic**, **Paper**, and **Other**. The system features real-time cloud connectivity via Adafruit IO and a responsive web dashboard for monitoring and control.

---

## ✨ Features

### Hardware Features

- ✅ Ultrasonic distance sensing (HC-SR04)
- ✅ Servo-based waste sorting mechanism
- ✅ OLED display (128x64) for local status
- ✅ WiFi connectivity (ESP32)
- ✅ Automatic reconnection logic

👉 **[View Wokwi Simulation](https://wokwi.com/projects/455437726866094081)** 👈

### Dashboard Features

- ✅ Real-time fill level monitoring
- ✅ Visual capacity bar with color coding
- ✅ Manual sorting controls
- ✅ Sorting activity logs with filtering
- ✅ Historical data charting (Chart.js)
- ✅ Connection status indicators
- ✅ Persistent data storage

### Cloud Features

- ✅ MQTT protocol via Adafruit IO
- ✅ 5 data feeds (distance, fill_percent, bin_full, sensor_ok)
- ✅ 2 command feeds (waste_type, target_bin)

---

## 🏗️ System Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│                 │         │                  │         │                 │
│  ESP32 DEVICE   │◄───────►│  ADAFRUIT IO     │◄───────►│  WEB DASHBOARD  │
│  (Hardware)     │  MQTT   │  (Cloud Bridge)  │  HTTP   │  (Browser)      │
│                 │         │                  │         │                 │
│ • Ultrasonic    │         │  5 Data Feeds    │         │ • HTML/CSS/JS   │
│ • Servo Motor   │         │  2 Command Feeds │         │ • Chart.js      │
│ • OLED Display  │         │  30 req/min      │         │   │
│                 │         │                  │         │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
```

---

## 🛠️ Hardware Requirements

### Core Components

| Component       | Model                 | Quantity | Purpose                 |
| --------------- | --------------------- | -------- | ----------------------- |
| Microcontroller | ESP32 Dev Board       | 1        | Main processor & WiFi   |
| Distance Sensor | HC-SR04 Ultrasonic    | 1        | Fill level detection    |
| Display         | SSD1306 OLED (128x64) | 1        | Local status display    |
| Motor           | SG90 Servo Motor      | 1        | Waste sorting mechanism |
| Power Supply    | 5V 2A Adapter         | 1        | System power            |

---

## 💻 Software Requirements

### ESP32 (Arduino IDE)

**Required Libraries:**

- WiFi (built-in)
- Wire (built-in)
- Adafruit_GFX
- Adafruit_SSD1306
- ESP32Servo
- Adafruit_MQTT

**Install via Arduino Library Manager:**

```
Sketch → Include Library → Manage Libraries
```

Search and install each library above.

### Dashboard

**Dependencies:**

- Chart.js (loaded via CDN in HTML)
- Modern web browser (Chrome, Firefox, Safari, Edge)

**No installation needed** - just open `index.html` in browser!

---

## 🚀 Setup Instructions

### Step 1: Create Adafruit IO Account

1. Go to [io.adafruit.com](https://io.adafruit.com)
2. Sign up for free account
3. Note your **username** and **AIO Key** (click on "My Key")

### Step 2: Create Feeds

Create these **5 feeds** in Adafruit IO:

| Feed Name      | Type    | Description                          |
| -------------- | ------- | ------------------------------------ |
| `distance`     | Integer | Distance sensor reading (cm)         |
| `fill_percent` | Integer | Fill level percentage (0-100)        |
| `bin_full`     | Boolean | Bin full status (0 or 1)             |
| `sensor_ok`    | Boolean | Sensor health (0 or 1)               |
| `waste_type`   | String  | Waste category (plastic/paper/other) |
| `target_bin`   | Integer | Target bin number (1/2/3)            |

**To create feed:**

1. Click "Feeds" → "New Feed"
2. Enter feed name exactly as shown above
3. Click "Create"

### Step 3: Configure ESP32 Code

1. Open `main.ino` in Arduino IDE
2. Update WiFi credentials:

   ```cpp
   #define WIFI_SSID     "Your_WiFi_Name"
   #define WIFI_PASS     "Your_WiFi_Password"
   ```

3. Update Adafruit IO credentials:

   ```cpp
   #define AIO_USERNAME   "your_username"
   #define AIO_KEY        "your_aio_key"
   ```

4. **Optional:** Adjust calibration values based on your bin:

   ```cpp
   #define EMPTY_DIST_CM  30  // Distance when bin is empty
   #define FULL_DIST_CM   8   // Distance when bin is full
   ```

5. **Optional:** Adjust servo angles for your mechanism:
   ```cpp
   #define ANGLE_PLASTIC  30   // Servo angle for plastic bin
   #define ANGLE_PAPER    90   // Servo angle for paper bin
   #define ANGLE_OTHER    150  // Servo angle for other bin
   ```

### Step 4: Upload to ESP32

1. Connect ESP32 via USB
2. Select board: **Tools → Board → ESP32 Dev Module**
3. Select port: **Tools → Port → (your ESP32 port)**
4. Click **Upload** (→) button
5. Wait for "Done uploading" message

### Step 5: Configure Dashboard

1. Open `script.js` in text editor
2. Update credentials (line ~23):

   ```javascript
   const CONFIG = {
     AIO_USERNAME: "your_username",  // ⚠️ CHANGE THIS
     AIO_KEY: "your_aio_key",        // ⚠️ CHANGE THIS
   ```

3. Save file

### Step 6: Open Dashboard

1. Open `index.html` in web browser
2. Dashboard should start loading data automatically
3. Check browser console (F12) for connection status

---

---

## 🤝 Contributing

Contributions are welcome! Feel free to:

- Report bugs
- Suggest features
- Submit pull requests
- Improve documentation

---

## 📄 License

This project is open source and available under the MIT License.

---

## 👥 Credits

**Developed by:** [Fazl , Adrian, Helin, Ahmed]
**Course:** [Introduction to IoT]
**Institution:** [SRH Berlin Univeristy of Applied Sciences]
**Year:** 2026

---

## 📧 Contact

For questions or support:

- Email: [frahmani2012@gmail.com]

---

## ⭐ Acknowledgments

- **Adafruit** for MQTT cloud platform
- **Espressif** for ESP32 development board
- **Arduino** community for libraries and support

---

**Made with ♻️ for a cleaner future**
