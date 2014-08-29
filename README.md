Raspberry Pi Server for MuleSoft Hackathon
=========

This server is implemented with Node.js, and Python.

## Setup Instructions

First, make sure you have Node.js, and npm installed on your pi:

```bash
sudo apt-get update
sudo apt-get upgrade
sudo wget http://node-arm.herokuapp.com/node_latest_armhf.deb
sudo dpkg -i node_latest_armhf.deb
node -v    #check if node is installed successfully
```

Next, clone this repository and install all the dependencies:

```bash
cd #move to home directory
git clone https://github.com/MuleSoftHackathon/pi.git
cd PiServer
npm install
```

Modify settings in pi.config if you need to, and start the server with the
following command:

```bash
nano pi.config  #modify the config, and put in an disdinct deviceID
./install.sh
```

Now whenever you boot your pi, the pi server will run automatically in the background.

## Sensors and APIs

### Range Sensor

```
GET /rangeSensor
```

This method needs no parameters.

### Toggle I/O Pin

```
GET /toggleIOPin
```

Calling this method will toggle a specific GPIO pin on the raspberry pi.

Parameters:
- `pin` : A number to specify the GPIO Pin you want to toggle on your Pi.
  - Eg. `pin=3` toggles GPIO3 on/off.

### Motion Sensor Hooks

```
POST /motionHook
```

Add a new web hook that triggers when the motion sensor detects a motion.

Parameters:
- `address` : A http address the pi will send a get request to when motion is
detected.
  - Eg. `address=http://127.0.0.1/callback`

```
DELETE /motionHook
```

Remove a web hook for the motion sensor on the raspberry.

Parameters:
- `address` : A http address of the web hook you want to remove.
  - Eg. `address=http://127.0.0.1/callback`
