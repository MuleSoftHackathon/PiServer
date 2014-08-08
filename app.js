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
var app    = express();
var router = express.Router();

var webHookMapping = {};
var PI_PORT = 8080;
var PI_DEVICE_ID = 'pipipi';

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
    device_id: PI_DEVICE_ID,
    device_type: 'pi',
    port: PI_PORT
  };
  var options = {
    url: url,
    json: piInfo
  };

  console.log('Register ourselves to APIServer@%s:%d', serverConfig.host, serverConfig.port);
  request.post(
    options,
    function (error, response, body) {
      if (!error && response.statusCode == 200) {
        console.log('Registered successfully');
      } else {
        console.log('Error occured %s: %s', response.statusCode, body.message ? body.message : '');
      }
    }
  );
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

  console.log('Adding new motion hook (' + address + ')');
  if (!webHookMapping.hasOwnProperty(address)) {
    child = spawn('sudo', ['python', 'python/waitForMotion.py', address], { detached: true });
    console.log('Script started successfully!');

    webHookMapping[address] = child.pid;
    res.status(201).json(makeResponse('Set up hook for ' +  address));
  }
  else{
    console.log('Ignored duplicate request');
    res.status(400).json(makeResponse('Hook already set up for ' + address));
  }
};

var removeMotionHook = function(req, res) {
  var address = String(req.body.address);

  if (webHookMapping.hasOwnProperty(address)) {
    console.log('Killing motion hook for ' + address);
    exec('sudo kill ' + webHookMapping[address], function (error, stdout, stderr){
      delete webHookMapping[address];

      console.log('Killed motion hook ' + address);
      res.status(200).json(makeResponse('Deleted'));
    });
  } else {
    console.log('Hook to delete not found:' + address);
    res.status(400).json(makeResponse('Motion hook was never set up'));
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

// simple logger for this router's requests
// all requests to this router will first hit this middleware
router.use(function(req, res, next) {
  console.log('------\n%s %s from %s', req.method, req.url, req.hostname);
  next();
});

// Routes
router.route('/motionHook')
.post(setupMotionHook)
.delete(removeMotionHook);

router.route('/ranger_sensor')
.get(getRangeSensorData);

router.route('/toggleIOPin')
.get(toggleIOPin);

// load api server config file
fs.readFile('apiserver.config', 'utf8', function (err, data) {
  if (err) {
    return console.log(err);
  }
  var serverConfig = JSON.parse(data);
  registerAPIServer(serverConfig);
});

// Start the server
app.all('*', router);
app.listen(PI_PORT);
console.log('Pi Server up and running on port %d', PI_PORT);
