import RPi.GPIO as GPIO
import time
import httplib
import sys
GPIO.setmode(GPIO.BCM)

INF = 4

GPIO.setup(INF,GPIO.IN)

while True:
	if GPIO.input(INF)==1:
		print 'MOTION FOUND'
		#10.250.1.58:8880
		conn = httplib.HTTPConnection("sys.argv[0]")
		conn.request("GET", "/motion_detected")
		r1 = conn.getresponse()
		time.sleep(1)
	else:
		print 'MOTION NOT FOUND'
	time.sleep(0.2)

GPIO.cleanup()
