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

var processQueue = [];
var processCount = 0;
// Global vaiables
var app    = express();
var router = express.Router();

var webHookMapping = {};
var PI_DEVICE_ID; // same as access key
var PI_PORT;

function makeResponse(message, data, status) {
  data    = data || [];
  status  = status || 'ok';

  return {
    data: data,
    message: message,
    status: status
  };
}

function registerAPIServer(serverConfig) {
  var url = 'http://' + serverConfig.host + ':' + serverConfig.port + serverConfig.endpoint;
  var piInfo = {
    accessKey: PI_DEVICE_ID,
    type: 'pi',
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
  var id = processCount;
  processCount++;

  processQueue.push(id);

  while(processQueue[0] != id){}

  console.log('Read range sensor data');
  pyShell.run('measure.py', function (err, results) {
    if (err) throw err;
    var result = {
      distanceCm: parseFloat(results[0]),
      distanceInches: parseFloat(results[0]) * 0.393701,
    };
    processQueue.shift();
    res.json(makeResponse('Success', result));
  });
};

var setupMotionHook =  function(req, res) {
  var address = String(req.body.address);
  var child;

  console.log('Adding new motion hook (' + address + ')');
  if (!webHookMapping.hasOwnProperty(address)) {
    child = spawn('sudo', ['python', 'python/waitForMotion.py', address], { detached: true });
    console.log('Script started successfully!');

    webHookMapping[address] = child.pid;
    res.json(makeResponse('Registered', {'address': address}));
  }
  else{
    console.log('Ignored duplicate request');
    res.status(400).json(makeResponse('Hook already set', {'address': address}, 'error'));
  }
};

var removeMotionHook = function(req, res) {
  var address = String(req.body.address);

  if (webHookMapping.hasOwnProperty(address)) {
    console.log('Killing motion hook for ' + address);
    exec('sudo kill ' + webHookMapping[address], function (error, stdout, stderr){
      delete webHookMapping[address];

      console.log('Killed motion hook ' + address);
      res.json(makeResponse('Deleted', {'address': address}));
    });
  } else {
    console.log('Hook to delete not found:' + address);
    res.status(400).json(makeResponse('Hook not registered', {'address': address}, 'error'));
  }
};

var getGPIOValue = function(req, res) {
  var pinNumber = parseInt(req.params.gpioNumber);
  var pinPath   = '/sys/devices/virtual/gpio/gpio' + pinNumber + '/value';
  var value     = parseInt(fs.readFileSync(pinPath, {encoding: 'utf8'}).charAt(0));

  console.log('Read GPIO%d: %d', pinNumber, value);
  res.json(makeResponse('Success', {'value': value}));
};

var setGPIOValue = function(req, res) {
  var pinNumber = parseInt(req.params.gpioNumber);
  var value     = parseInt(req.body.value);
  var pinPath   = '/sys/devices/virtual/gpio/gpio' + pinNumber + '/value';

  console.log('Set GPIO%d to %d', pinNumber, value);
  gpio.write(pinNumber, value, function(err){
    if (err) {
      res.status(500).json(makeResponse(err.message, [], 'error'));
    } else {
      res.json(makeResponse('Success', {'value': value}));
    }
  });
};

var toggleIOPin = function(req, res) {
  var pinNumber = parseInt(req.params.gpioNumber);
  var pinPath   = '/sys/devices/virtual/gpio/gpio' + pinNumber + '/value';
  var status    = fs.readFileSync(pinPath, {encoding: 'utf8'}).charAt(0);
  var value     = status === '0' ? 1 : 0;

  console.log('Set GPIO%d to %d', pinNumber, value);
  gpio.write(pinNumber, 0, function(err){
    if (err) {
      res.status(500).json(makeResponse(err.message, [], 'error'));
    } else {
      res.json(makeResponse('Success', {'value': value}));
    }
  });
};

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// simple logger for this router's requests
router.use(function(req, res, next) {
  console.log('------\n%s %s from %s', req.method, req.url, req.hostname);
  next();
});

// check accessKey
router.use('/motionHook', checkAccessKey);
router.use('/rangeSensor', checkAccessKey);
router.use('/gpio', checkAccessKey);

function checkAccessKey(req, res, next) {
	var reqAccessKey = req.query.accessKey || req.body.accessKey;
	if(PI_DEVICE_ID != null && PI_DEVICE_ID !== reqAccessKey) {
		res.status(400).json({
			message : 'Invalid access key!'
		});
		console.log('invalid access key / id.')
		return;
	}
	next();
}

// Routes
router.route('/motionHook')
.post(setupMotionHook)
.delete(removeMotionHook);

router.route('/rangeSensor')
.get(getRangeSensorData);

router.route('/gpio/:gpioNumber')
.get(getGPIOValue)
.post(setGPIOValue);

router.route('/gpio/:gpioNumber/toggle')
.get(toggleIOPin);

app.all('*', router);

// load api server config file
fs.readFile('pi.config', 'utf8', function (err, data) {
  if (err) {
    return console.log(err);
  }

  var config = JSON.parse(data);
  PI_PORT = config.port || 8080;
  PI_DEVICE_ID = config.accessKey;
  registerAPIServer(config.apiServer);

  // Start the server
  app.listen(PI_PORT);
  console.log('Pi Server up and running on port %d', PI_PORT);
});
