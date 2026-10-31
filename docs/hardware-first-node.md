# First-node commissioning: ESP32 + DS18B20

Current inventory reported: a new ESP32 and a DS18B20 with module; not wired. Exact ESP32 board, module pin labels, water-level sensor and existing firmware are not yet known. The steps below do not assume a specific GPIO pinout.

## 1. Identify before wiring

Read the board's printed model (for example ESP32-WROOM DevKit, ESP32-C3, or ESP32-S3) and the sensor module's printed VCC/GND/DATA labels. They do not share interchangeable pinouts. Confirm the development board's pinout and the module's voltage requirements from their documentation. A photo or the printed model/pin labels will let us select the actual GPIO and firmware target.

Keep power disconnected while wiring. For a module documented to operate at 3.3 V, use ESP32 3V3 → module VCC, common GND → GND, and an available input/output GPIO → module DATA. Avoid boot-strapping pins, flash pins, input-only pins and USB pins as appropriate for the exact board. Do not connect a 5 V-pulled-up data line to an ESP32 GPIO.

DS18B20 1-Wire needs a pull-up to the logic supply, commonly 4.7 kΩ. Inspect whether the module already supplies it before adding another. Use normal three-wire power for the initial test; do not start with parasite power. Do not rely on probe wire colors without the supplier pinout.

Keep the board and module dry. Only a probe specifically rated and sealed for immersion belongs in water; an exposed sensor/module is not made waterproof by its DS18B20 chip.

## 2. Local temperature test first

In Arduino IDE, install the Espressif ESP32 board package and select the exact development board and serial port. Use the maintained **OneWire** and **DallasTemperature** libraries. Start with their single-sensor example, setting its 1-Wire GPIO to the verified DATA pin.

Expected acceptance checks:

- Serial output identifies one sensor and its 1-Wire address.
- Repeated room-temperature readings are plausible and stable after conversion.
- Touching/warming the probe changes readings gradually.
- Compare against a reference thermometer in a stable environment and record the difference; do not claim calibration from one comparison.
- Disconnecting the probe produces an explicit missing/error state, not a retained “live” reading.
- Reject disconnected values (commonly −127 °C) and power-on/not-converted values (commonly 85 °C) for this aquaculture workflow. Wait for conversion completion before reading; do not convert those failures into 0 °C.

Record board model, GPIO, sensor address, cable length, sampling interval and reference comparison. Do not connect a pump for this test.

## 3. Node → ESP-NOW → gateway

After the standalone sensor works, we can implement board-specific firmware using:

- A provisioned node slot/UUID and device identity; no raw credentials in Git.
- A packet version, node boot UUID, monotonic sample sequence, temperature and sensor-health flag.
- Missing water level and battery as null/unavailable until actually instrumented.
- Matching ESP-NOW Wi-Fi channel with the gateway's router channel.
- A receive queue; no HTTP/TLS work from an ESP-NOW callback.
- Gateway time synchronization and capture/receive timestamp provenance.
- Retry/backoff, duplicate handling and reconnect tests.
- Verified TLS trust for cloud forwarding; never `setInsecure()`.

The cloud supports nullable uninstrumented gateway battery/voltage/charging and node water/battery fields. A node with incomplete sensor capability should be reported degraded rather than healthy; it can display a real temperature but will not contribute to the conservative healthy-node aggregate until its required sensors work.

Before writing and flashing firmware we still need the printed ESP32 model, module pin labels and your intended water-level sensor model. The gateway needs a separate ESP32 from the monitoring node for the full ESP-NOW path.
