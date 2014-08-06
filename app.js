var fs      = require('fs');
var gpio    = require('pi-gpio');
var sleep   = require('sleep');
var pyShell = require('python-shell');
var express = require('express');
var exec    = require('child_process').exec;
var spawn   = require('child_process').spawn;
var bodyParser = require('body-parser');

var app = express();

app.listen(8080);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded());

app.get('/ranger_sensor', getRangeSensorData);
app.post('/motionHook', setupMotionHook);
app.delete('/motionHook', removeMotionHook);
app.get('/togglelight', togglelight);

var getRangeSensorData = function (req, res) {
  pyShell.run('measure.py', function (err, results) {
    if(err) throw err;
    var result = {
      distanceInCM: parseFloat(results[0]),
      distanceInInches: (parseFloat(results[0]) * 0.393701),
      distanceInMeters: (parseFloat(results[0]) / 100)
    };
    res.send(result);
  });
};

//MY ADDRESS = 10.250.1.58:8880
var setupMotionHook =  function (req, res) {
  var address = '' + req.body.address;
  var list    = JSON.parse(fs.readFileSync('motionIPList.txt',{encoding: 'utf8'}));

  if(!list.hasOwnProperty(address)){
    console.log('Starting execution!');
    var child = spawn('sudo', ['python', 'python/waitForMotion.py', address], { detached: true });
    console.log('Finished execution!');
    list[address] = child.pid;
    console.log('Starting writeFile!');
    fs.writeFile('motionIPList.txt',JSON.stringify(list),function(err){
      if(err) throw err;
      console.log('Finished writeFile!');

      res.send('SET UP AT PORT: ' +  address);
    });
  }
  else{
    res.send('Already running script');
  }
};

var removeMotionHook = function (req, res) {
  var address = req.query.address;

  var list = JSON.parse(fs.readFileSync('motionIPList.txt'));
  if(list.hasOwnProperty(address)){
    exec('sudo kill ' + list[address], function (error, stdout, stderr){
      delete list[address];
      fs.writeFile('motionIPList.txt',JSON.stringify(list),function(err){
        if(err) throw err;
        res.send('deleted');
      });
    });
  }
  else{
    res.send('Script not running');
  }
};

var togglelight = function (req, res) {
  var LIGHT = parseInt(req.query.pin);
  var pathToLIGHT = '/sys/devices/virtual/gpio/gpio2/value';
  var status = fs.readFileSync(pathToLIGHT, {encoding: 'utf8'}).charAt(0);
  console.log(status);

  if( status == '0'){
    gpio.write(LIGHT, 1, function(err){
      if(err) throw err;
      console.log('Turned light on');
      res.send(null);
    });
  }
  else{
    gpio.write(LIGHT, 0, function(err){
      if(err) throw err;
      console.log('Turned light off');
      res.send(null);
    });
  }
};
