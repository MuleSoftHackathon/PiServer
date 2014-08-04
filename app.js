var express = require('express');
var app = express();
var gpio = require("pi-gpio");
var sleep = require('sleep');
var fs = require('fs');
var exec = require('child_process').exec;
var PythonShell = require('python-shell');
app.listen(8080);

app.get('/ranger_sensor', function (req, res) {
  PythonShell.run('measure.py', function (err, results) {
    if(err) throw err;
    var result = {
      distanceInCM: parseFloat(results[0]),
      distanceInInches: (parseFloat(results[0]) * 0.393701),
      distanceInMeters: (parseFloat(results[0]) / 100)
    };
    res.send(result);
  });
});
app.get('/setupMotionHook', function (req, res) {
  var address = req.query.address;
  exec("nohup python python/waitForMotion.py " +address+" &", function (error, stdout, stderr){
    res.send('SET UP AT PORT: ' +  address);
  });
});
app.get('/togglelight', function (req, res) {
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
});













