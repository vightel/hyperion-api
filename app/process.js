var api 			= require('sat-api-lib');
var process			= require('process');
var request			= require('request');
var format			= require('string-format-js');
var path			= require('path');
var os				= require('os');
var mkdirp 			= require('mkdirp');
var util			= require('util');
var fs				= require('fs');
var async			= require('async');

var sharp 			= require('sharp');
var algorithms		= require('./algorithms')

var appRoot;

if (process.env.NODE_ENV == 'development') {
	appRoot = process.env.PWD;
} else {
	appRoot = "/tmp"
}

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

function composite(scene_id, bands, meta, req, cb ) {
	// probably run a python script here
 	console.log("compositing...", scene_id, bands)
	try {
		// when we are done post back to user
		var user_id 		= req.body.user_id
		var user_name		= req.body.user_name
		var channel_id		= req.body.channel_id
 	    var product_name	= scene_id
		
		product_name += "_COMPOSITE_B"+bands.join("_B")
		
		console.log("compositing...", product_name, user_id, user_name, channel_id)
		
		// get metadata file
		var meta_url 	= meta.metadata
		request.get(meta_url, function(err, data) {
			if( err ) {
			 	var msg = {
					token: 		process.env.SLACK_OAUTH_ACCESS_TOKEN,
					channel: 	channel_id,
					text: 		"Error compositing completed for @"+user_name+ ", " +scene_id+" bands:"+bands.join(",")
			 	}
				if( channel_id ) {
					return postMessage(msg)
				} else {
					return res.send("Compositing error:", err)
				}
			}

			var metadata = JSON.parse(data.body)
			//console.log(JSON.stringify(metadata, null, '\t'))
		
			var year	= scene_id.substring(10,14)
			var doy		= scene_id.substring(14,17)
			
			var tmp_dir = path.join(appRoot,'tmp',year, doy, product_name)
			mkdirp.sync(tmp_dir)
		
			console.log("tmp_dir", tmp_dir)
			// Grab the files from S3
			hrefs = []
			inputs=[]
			
			var band_str;
			for( var b in bands ) {
				var band 				= bands[b]
				band_str				= "band_"+band;
				if( band < 100) band_str = "band_0" + band
				if( band < 10 ) band_str = "band_00"+band
				var geotiffs = metadata.actions.downloads.GEOTIFF
				for( var g in geotiffs) {
					var geotif = geotiffs[g]
					if( geotif[band_str]) {
						var href= geotif[band_str]['href']
						hrefs.push(href)						
						break
					}
				}
			}
			
			function downloadHref( href, cb2 ) {
				var arr = href.split('/')
				var fileName = path.join(tmp_dir,arr[arr.length-1])
				inputs.push(fileName)
				
				if( !fs.existsSync(fileName) ) {
					var ws = fs.createWriteStream(fileName)
					ws.on('finish', function(){
						console.log("finished downloading", href)
						cb2(err, null)
					})
					request(href).pipe(ws)
				} else {
					cb2(null, null)
				}
			}
			
			// download s3 files if they don't exists
			async.map(hrefs, downloadHref, function(err, results) {
				console.log("Downloaded", err, results)
				
				product_name += ".png"
				output = path.join(tmp_dir,product_name)
				if( !fs.existsSync(output)) {
					console.log("generating", output)
					algorithms.composite(inputs, output, function(err) {
						console.log("Done generating", err)
					 	var msg = {
							token: 		process.env.SLACK_OAUTH_ACCESS_TOKEN,
							channel: 	channel_id,
							text: 		"@"+user_name+ ", Compositing completed for " +scene_id+" bands:"+bands.join(","),
							attachments: []
					 	}
	
						var host = req.protocol + "://" + req.get('host')
						var attachment = {
							'title': "Product Page",
							'title_link': host+"/product/"+product_name
						}
						msg.attachments.push(attachment)
	
						if( channel_id ) {
							postMessage(msg)
							cb(err, null)
						} else {
							cb(err, host+"/product/"+product_name)
						}					
					})
				} else {
					console.log("Product already exists", output)
					cb(null)
				}
			})
		})
	} catch(e) {
		console.log("Exception", e)
	}
}

function perform_destriping(hash, meta, req, res ) {
	var scene_id 	= hash['scene_id']
	
	var text = "Destriping for " + scene_id + " bands " + bands.join(",") + " has beed submitted...\n"
	text += "I will let you know when the job is completed."
	res.send(text)

	destripe(scene_id, bands, meta, req, function(err) {
		console.log("Done destriping!", err)
	})
}

function perform_composite( hash, meta, req, res ) {
	var scene_id 	= hash['scene_id']
	var bands 		= [hash['red'], hash['green'], hash['blue']]
	//var text 		= "Composite for " + scene_id + " bands " + bands.join(',') + " has beed submitted...\n"
	//text += "I will let you know when the job is completed."
	//res.send(text)

	composite(scene_id, bands, meta, req, function(err, url) {
		console.log("Done composite!", err)
		if( !err ) res.redirect(url)
	})
}

function process_algorithm(params, meta, req, res) {
	i = 0

	var hash = {}
	while( i < params.length ) {
		var parr 		= params[i].split('=')
		var key			= parr[0]
		var value		= parr[1]

		hash[key]		= value
		i++
	}
	
	var algorithm = hash['algorithm']
	console.log("*** Process", algorithm, hash)
	
	if( algorithm == undefined ) return res.send("Algorithm not defined")

	if( algorithm.indexOf("destrip") >= 0 ) return perform_destriping(hash, meta, req, res )
	if( algorithm.indexOf("composite") >= 0 ) return perform_composite(hash, meta, req, res )
		
	res.send(algo + " algorithm not implemented for "+scene_id)
}

// Processing through SLACK
//	/eo1t process scene_id=EO1H0110282013228110T3_L1U red=26 green=20 blue=12 algorithm=composite
//	/eo1 process scene_id=EO1H0110282013228110T3_L1U bands=26,20,12 algorithm=composite

// Processing through http

module.exports = {
	index: function(req,res) {
		var host 	= req.protocol + '://' + req.get('host')
		console.log("Process", req.body, req.method)
		
		params 				= []
		if( req.body.scene_id) {
			req.query['search'] = req.body.scene_id
			params[0]			= "algorithm="+req.body.algorithm
			params[1]			= "scene_id="+req.body.scene_id
			scene_id 			= req.body.scene_id
			
			if( req.body.red  ) {
				params[2]		= "red="+req.body.red
				params[3]		= "green="+req.body.green
				params[4]		= "blue="+req.body.blue
			}
		} else {
			var text 			= req.body.text
			params				= text.split(' ')
		
			scene_id = params[1]	
			req.query['search'] = 	scene_id
		}
		console.log("index", params)
			
		if( params.length >= 2 ) {
			console.log("Searching ", scene_id)
			
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
				//console.log(resp.results[0])
				var meta = resp.results[0]
				process_algorithm(params, meta, req, res)
			})
		}		
	}
}