var request			= require('request');
var moment 			= require('moment');
var elastic_search 	= require('./search.js');
var processing 		= require('./process.js');

module.exports = {
	
	//
	// Respond to slack commands
	//
	// /eo1t process EO1H0110282013228110T3_L1U bands=10,11 algo=destripe
	
	cmds: function(req, res) {
		console.log("slack")
		console.log(req.body)
	
		var token 	= req.body.token
	
		if( (process.env.NODE_ENV != 'development') && (token != process.env.SLACK_VERIFICATION_TOKEN)) {
			console.log("Invalid Token", token, process.env.SLACK_VERIFICATION_TOKEN)
			return res.sendStatus(404)
		}
	
		var text 	= req.body.text
		var host 	= req.protocol + '://' + req.get('host')
		
		var params	= text.split(' ')
		console.log(params)
	
		if( params[0] == 'search') {
			return elastic_search.search(req,res)
		} else if( params[0] == 'process') {
			return processing.index(req,res)
		} else if( params[0] == 'help') {
			text = "Slack Command Help:\n"
			text += "\t/search EO1* | search <city> | search <q> limit=5 \n"
			text += "\t/process <scene> bands=5 algorithm=destripe \n"
			var data = {
				text: text
			}
			res.json(data)	
		}
	},
	
	search: function(req, res) {
		var id 		= req.params['id']
		var host	= req.protocol + '://' + req.get('host')
		
		searchPost(function(err, data) {
			if( !err ) {
				res.send(data)
			} else {
				res.sendStatus(err)
			}
		})
	},
	
	//
	// search slack for POST about specific product from our app
	//
	searchPost: function(id, cb) {
		var url		= "https://slack.com/api/search.messages"

		var data_request = {
			token: 		process.env.SLACK_OAUTH_ACCESS_TOKEN,
			query: 		id,
			pretty: 	1,
			sort: 		'timestamp',
			sort_dir: 	'asc',
			highlight: 	0
		}

		var options = {
			url: 	url,
			method: "GET",
			qs: 	data_request
		}

		request(options, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				var data = JSON.parse(body)
				//console.log("*slack search",JSON.stringify(data,null,'\t'))
				if(!data.ok) {
					console.error("SLACK search error", data)
					return cb(null, null)
				}
				// go through matches
				if( data.messages.total > 0 ) {
					for( var m in data.messages.matches) {
						var match 		= data.messages.matches[m]
						var iid			= match.iid
						var permalink	= match.permalink
						if( match.username == 'hyperionapp') {
							var ts		= match.ts
							// console.log("** match", match)
							// we need to retrieve that messages reactions from history
							var url 	= 'https://slack.com/api/channels.history'
							var data_request = {
								token: 		process.env.SLACK_OAUTH_ACCESS_TOKEN,
								channel: 	match.channel.id,
								latest: 	ts,
								inclusive: 	1,
								count:  	1
							}
							var options = {
								url: 	url,
								method: "GET",
								qs: 	data_request
							}
							request(options, function (error, response, body) {
								if (!error && response.statusCode == 200) {
									var data = JSON.parse(body)
									if( !data.ok ) {
										console.error(data)
										cb(error, null)
										return
									}
									//console.log("*slack message", JSON.stringify(data,null,'\t'))
									var message = data.messages[0]
									delete message.attachments
									message.iid 		= iid
									message.permalink 	= permalink
								
									message.thumbsup	= 0
									message.thumbsdown	= 0
								
									for( var r in message.reactions ) {
										var reaction = message.reactions[r]
										if( reaction.name == "+1") message.thumbsup 	= reaction.count
										if( reaction.name == "-1") message.thumbsdown 	= reaction.count
									}
									//console.log("**",JSON.stringify(message,null,'\t'))
									cb(error, message)
								} else {
									console.log("channel history error", error)
									cb(error, null)
								}
							})
							break;
						}
					}
				} else {
					cb(null, null)
				}
			} else {
				console.log(error)
				cb(error, null)
			}
		})
	},
	actions: function(req,res){
		console.log("Slack actions", req.body)
		res.send(req.body.challenge)
	},
	
	oauth: function(req, res) {
		var host	= req.protocol + '://' + req.get('host')
		console.log("Slack Oauth")
		
	    if (!req.query.code) { // access denied
	       res.redirect(host);
	       return;
	    }
		
		var data = {
			form: {
				client_id: process.env.SLACK_CLIENT_ID,
				client_secret: process.env.SLACK_CLIENT_SECRET,
				code: req.query.code
			}};
		console.log("oauth posting", data)
			
		request.post('https://slack.com/api/oauth.access', data, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				// Get an auth token
				var token = JSON.parse(body).access_token;

				// Get the team domain name to redirect to the team URL after auth
				request.post('https://slack.com/api/team.info', {form: {token: token}}, function (error, response, body) {
					if (!error && response.statusCode == 200) {
						if(JSON.parse(body).error == 'missing_scope') {
							res.send('Hyperion API has been added to your team!');
						} else {
							var team = JSON.parse(body).team.domain;
							res.redirect('http://' +team+ '.slack.com');
						}
					}
				});
			}
		})
	},
	//
	// Post Message with Attachments to SLACK
	//
	postMessage: function(req, res) {
		console.log("postMessage", req.params)
		var id 		= req.params['id']
		var host	= req.protocol + '://' + req.get('host')
		var scene	= id.split("_")[0]
		var year	= scene.substring(10,14)
		var doy		= scene.substring(14,17)
	
		var url2	= "https://s3.amazonaws.com/eo1-hyperion/L1U/" + year + "/" + doy +"/"
		url2 		+= scene + "/" + id +".json"
		//console.log(url2)
		
		var slack_url = process.env.SLACK_WEBHOOK
		
		request.get(url2, function(err, response, body) {
			if(!err) {
				var data = JSON.parse(body)
				var msg = {
					"text": "L1U Surface Reflectance: "+id,
					"attachments": [
						{
							"fallback": id + " Hyperion Surface Reflectance.",
							"color": "#36a64f",
							"pretext": "Product is available ",
							"author_name": "Petya Campbell",
							"author_link": "https://www.researchgate.net/profile/Petya_Campbell",
							"author_icon": "https://i1.rgstatic.net/ii/profile.image/AS%3A279758559563781%401443711046621_l/Petya_Campbell.png",
							"title": id,
							"title_link": host+"/show/"+id,
							"text": "L1U Surface Reflectance",
							"fields": [
								{
									"title": "Priority",
									"value": "High",
									"short": false
								}
							],
							"image_url": data.thumbnail,
							"thumb_url": data.thumbnail,
							"footer": "Hyperion API",
							"footer_icon": host+"/favicon-32x32.png",
							"ts": moment().unix()
						}
					]
				}
				
				var options = {
				  method: 'post',
				  body: msg,
				  json: true,
				  url: slack_url
				}
				
				request(options, function(err,res,body) {
					if (err) {
					    console.error('error posting json: ', err)
					    throw err
					  }
					  var headers = res.headers
					  var statusCode = res.statusCode
					  console.log('headers: ', headers)
					  console.log('statusCode: ', statusCode)
					  console.log('body: ', body)
				})
				
				console.log(msg)
				res.sendStatus(200)
			}
		})
	}
}