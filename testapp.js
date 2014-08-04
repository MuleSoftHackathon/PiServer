var express = require('express');
var app = express();


var fs = require('fs');

app.listen(8880);

app.get('/motion_detected', function (req, res) {

  console.log('MOTION DETECTED');
  res.send(null);
});
