var express = require('express');
var router = express.Router();
var fs = require('fs');

router.get('/', function(req, res) {
	var data = fs.readFileSync('data.json');
  	res.send(data);
});

module.exports = router;
