import RPi.GPIO as GPIO
import time
import httplib
import sys
GPIO.setmode(GPIO.BCM)

INF = 4

GPIO.setup(INF,GPIO.IN)

while True:
	#When the infrared sensor goes off...
	if GPIO.input(INF)==1:
		#10.250.1.58:8880
		try:
			#Send an alert to the desired port
			conn = httplib.HTTPConnection(sys.argv[1])

			conn.request("GET", "/motion_detected")
			r1 = conn.getresponse()
		except:
			print "Error Connecting to port: %s" % sys.argv[1]
		time.sleep(1)

	time.sleep(0.2)

GPIO.cleanup()
