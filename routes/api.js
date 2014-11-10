var express = require('express');
var router = express.Router();
var Twit = require('twit');
var fs = require('fs');
var _ = require('underscore');
var config = JSON.parse(fs.readFileSync('config.json'));

// var T = new Twit(config);
// since_id: 530206815405891600

/* GET users listing. */
router.get('/', function(req, res) {
	var data = fs.readFileSync('data.json');
  	res.send(data);
});

// function getTweets (max_id, tweetData) {
// 	if (!tweetData) tweetData = [];

//   	T.get('search/tweets', { q: '#ListenAi since:2014-11-04', max_id: max_id, count: 100 }, function(err, data, response) {
// 		console.log(response)
// 		if (data && data.statuses.length > 1) {
// 		_.each(data.statuses, function (status) {
// 			tweetData.push({ user: status.user.screen_name, text: status.text, created_at: status.created_at });
// 			if (status.id < max_id || !max_id) max_id = status.id;
// 		});
// 			getTweets(max_id, tweetData);
// 		} else {
// 			var data = JSON.stringify(tweetData);
// 			fs.writeFile('data1.json', data, function (err) {
// 				if (err) { 
// 					console.log(err)
// 				} else {
// 					console.log('file written')
// 				}
// 			});
// 		}
// 	});	
// }

module.exports = router;
