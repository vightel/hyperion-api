var api 			= require('sat-api-lib');
var process			= require('process');
var request			= require('request');
var format			= require('string-format-js')

function postMessage(msg) {
	//var url = "https://slack.com/api/chat.postMessage"
	var url = process.env.SLACK_WEBHOOK
	
	var options = {
		method: 'post',
		body: 	msg,
		json: 	true,
		url: 	url,
		headers: {
			"Content-Type": "application/json; charset=UTF-8" 
		}
	}
		//'encoding': null
	
	//delete msg.attachments
	console.log("posting", msg)
	
	request(options, function(err,res,body) {
		if (err) {
			console.error('error posting json: ', err)
			throw err
		} else {
			console.log("message posted", body)
		}
	})
}

function destripe(scene_id, bands, meta, req, cb ) {
	// probably run a python script here
 	console.log("destriping...")
	try {
		// when we are done post back to user
		var user_id 		= req.body.user_id
		var user_name		= req.body.user_name
		var channel_id		= req.body.channel_id
 	    var product_name	= scene_id.split("_")[0]
		
		product_name += "_DESTRIPE_B"+bands.join("_B")
		
		console.log("destriping...", user_id, user_name, channel_id)
		
		// get metadata file
		var meta_url 	= meta.metadata
		request.get(meta_url, function(err, data) {
			if( err ) {
			 	var msg = {
					token: 		process.env.SLACK_OAUTH_ACCESS_TOKEN,
					channel: 	channel_id,
					text: 		"Error Destriping completed for @"+user_name+ ", " +scene_id+" bands:"+bands.join(",")
			 	}
				return postMessage(msg) 
			}

			var metadata = JSON.parse(data.body)
			//console.log(JSON.stringify(metadata, null, '\t'))
		
		 	var msg = {
				token: 		process.env.SLACK_OAUTH_ACCESS_TOKEN,
				channel: 	channel_id,
				text: 		"@"+user_name+ ", Destriping completed for " +scene_id+" bands:"+bands.join(","),
				attachments: []
		 	}
	
			//for( var b in bands) {
			//	var band 	= parseInt(bands[b])
			//	var bandstr = "band_%03d".format(band)
				//console.log("Bands", band, bandstr)
				//var url 	= "meta.actions.downloads.GEOTIFF"
				// find url
				//var geotiffs = metadata.actions.downloads.GEOTIFF				
			//}
			var host = req.protocol + "://" + req.get('host')
			var attachment = {
				'title': "Product Page",
				'title_link': host+"/show/"+product_name
			}
			msg.attachments.push(attachment)
	
			postMessage(msg) 
		})
	} catch(e) {
		console.log("Exception", e)
	}
}

function perform_destriping(scene_id, bands, meta, req, res ) {
	var text = "Destriping for " + scene_id + " bands " + bands.join(",") + " has beed submitted...\n"
	text += "I will let you know when the job is completed."
	res.send(text)

	destripe(scene_id, bands, meta, req, function(err) {
		console.log("Done destriping!", err)
	})
}

function process_algorithm(params, meta, req, res) {
	var scene_id	= params[1]
	var algorithm 	= undefined
	var bands		= []
	
	console.log("*** Process...")
	
	i = 2

	while( i < params.length ) {
		var parr 		= params[i].split('=')
		var key			= parr[0]
		var value		= parr[1]

		if( key.indexOf("algo") >= 0 ) {
			algorithm = value
		} else if( key == 'bands') {
			bands = value.split(',')
		}
		i++
	}

	console.log("*** Process", algorithm, bands)
	
	if( algorithm == undefined ) return res.send("Algorithm not defined")
	if( bands.length == 0 ) return res.send("bands are not specified")

	if( algorithm.indexOf("destrip") >= 0 ) return perform_destriping(scene_id, bands, meta, req, res )
		
	res.send(algo + " algorithm not implemented for "+scene_id)
}

module.exports = {
	index: function(req,res) {
		var text 	= req.body.text
		var host 	= req.protocol + '://' + req.get('host')
		
		var params	= text.split(' ')
		
		var scene_id	= undefined
		
		if( params.length >= 2 ) {
			scene_id = params[1]	
			req.query['search'] = 	scene_id
			var s 				= new api(req);
			s.satelliteName 	= 'eo1';
			
			// Check if scene is valid
			s['eo1'](function (err, resp) {
				if (err) {
					return res.status(400).send({details: err.message});
				}
				
				if(!err ) {
					// text = 'found:' + resp.meta.found + " limit:"+req.query['limit']+"\n"
					if( resp.meta.found == 0 ) return res.send("scene not found: "+scene_id )
				} else {
					return res.send("error searching for scene: " + scene_id)
				}
				console.log(resp.results[0])
				var meta = resp.results[0]
				process_algorithm(params, meta, req, res)
			})
		}		
	}
}