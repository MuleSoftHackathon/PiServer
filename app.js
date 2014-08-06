// Include node modules
var fs         = require('fs');
var gpio       = require('pi-gpio');
var sleep      = require('sleep');
var pyShell    = require('python-shell');
var express    = require('express');
var exec       = require('child_process').exec;
var spawn      = require('child_process').spawn;
var bodyParser = require('body-parser');

// Global vaiables
var app = express();
var webHookMapping = {};

function makeResponse(message, data) {
  data = data || [];
  var res = {};

  res.message = message;
  res.data = data;
  return res;
}

var getRangeSensorData = function(req, res) {
  pyShell.run('measure.py', function (err, results) {
    if (err) throw err;
    var result = {
      distanceInCm: parseFloat(results[0]),
      distanceInInches: parseFloat(results[0]) * 0.393701,
      distanceInMeters: parseFloat(results[0]) / 100
    };
    res.json(makeResponse('success', result));
  });
};

//MY ADDRESS = 10.250.1.58:8880
var setupMotionHook =  function(req, res) {
  var address = String(req.body.address);
  var child;

  if (!webHookMapping.hasOwnProperty(address)) {
    console.log('Starting script (' + address + ')');
    child = spawn('sudo', ['python', 'python/waitForMotion.py', address], { detached: true });
    console.log('Script started successfully!');

    webHookMapping[address] = child.pid;
    res.status(201).json(makeResponse('SET UP AT PORT: ' +  address));
  }
  else{
    res.status(400).json(makeResponse('Already running script for ' + address));
  }
};

var removeMotionHook = function(req, res) {
  var address = String(req.body.address);

  if (webHookMapping.hasOwnProperty(address)) {
    console.log('Killing web hook for ' + address);
    exec('sudo kill ' + webHookMapping[address], function (error, stdout, stderr){
      delete webHookMapping[address];

      console.log('Killed (' + address + ')');
      res.status(200).json(makeResponse('deleted'));
    });
  } else {
    res.status(400).json(makeResponse('Script not running'));
  }
};

var toggleIOPin = function(req, res) {
  var pinNumber = parseInt(req.query.pin);
  var pinPath   = '/sys/devices/virtual/gpio/gpio' + pinNumber + '/value';
  var status    = fs.readFileSync(pinPath, {encoding: 'utf8'}).charAt(0);
  var message;

  if (status === '0'){
    gpio.write(pinNumber, 1, function(err){
      if (err) throw err;
      message = 'Turned pin on';
    });
  } else {
    gpio.write(pinNumber, 0, function(err){
      if (err) throw err;
      message = 'Turned pin off';
    });
  }

  console.log(message);
  res.status(200).json(makeResponse(message));
};

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.route('/motionHook')
.post(setupMotionHook)
.delete(removeMotionHook);

app.route('/ranger_sensor')
.get(getRangeSensorData);

app.route('/toggleIOPin')
.get(toggleIOPin);

app.listen(8080);
console.log('Pi Server up and running..');
