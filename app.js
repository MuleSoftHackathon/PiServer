// Include node modules
var fs         = require('fs');
var request    = require('request');
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
var PI_PORT = 8080;

function makeResponse(message, data) {
  data = data || [];
  var res = {};

  res.message = message;
  res.data = data;
  return res;
}

function registerAPIServer(serverConfig) {
  var url = 'http://' + serverConfig.host + ':' + serverConfig.port + serverConfig.endpoint;
  var piInfo = {
    device_id: 'pipipi',
    device_type: 'pi',
    port: PI_PORT
  };
  var options = {
    url: url,
    json: piInfo
  };

  console.log('Register api server %s:%d', serverConfig.host, serverConfig.port);
  request.post(
    options,
    function (error, response, body) {
      if (!error && response.statusCode == 200) {
        console.log('Registered successfully');
      } else {
        console.log('Error occured %s', response.statusCode);
      }
    }
  );
}

var getRangeSensorData = function(req, res) {
  console.log('Get range sensor data');
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

  console.log('Adding new motion hook (' + address + ')');  
  if (!webHookMapping.hasOwnProperty(address)) {
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

fs.readFile('apiserver.config', 'utf8', function (err, data) {
  if (err) {
    return console.log(err);
  }
  var serverConfig = JSON.parse(data);
  registerAPIServer(serverConfig);
});

app.listen(PI_PORT);
console.log('Pi Server up and running..');
