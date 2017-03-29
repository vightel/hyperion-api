var api 			= require('sat-api-lib');
var request			= require('request');

function getDevelopmentSeed(sat, req,res) {
	var url = "https://api.developmentseed.org/satellites/"+sat
	if( Object.keys(req.query).length>0){
		url += "?"
		for (q in req.query ) {
			url += q + "="+ req.query[q]+"&"
		}
		url = url.substring(0, url.length - 1);
	}
  	//search('landsat', req, res);
	request.get(url, function(err,response,body) {
		res.send(body)
	})
}

function geoquery (action, req, res) {
	var bbox = req.query['bbox'].split(',')
	console.log("geoquery", bbox)
	
	var query = {
		method: "GET",
		query: {
			intersects:{
				type: "FeatureCollection",
				features: [
					{
						type: "Feature",
						properties: {},
						geometry: {
							type: "Polygon",
							coordinates: [
								[
									[bbox[0], bbox[1]],
									[bbox[0], bbox[3]],
									[bbox[2], bbox[3]],
									[bbox[2], bbox[1]],
									[bbox[0], bbox[1]]
								]
							]
						}
					}
				]
			}
		}
	} 
	console.log(query)
	
	var s = new api(query);
	s.satelliteName = 'eo1';
	s.geojson(function(err, response) {
		console.log(err, response)
		if( !err) {
			res.send(response)
		} else {
			console.log("geoquery Error", err)
			res.sendStatus(500)
		}
	})	
}

function search (action, req, res) {
	// Add a few more terms
	req.query['search'] = req.query['scene_id']			// Legacy Search
	delete req.query['scene_id']
	console.log("search", JSON.stringify(req.query))
	var s = new api(req);
		
	s[action](function (err, resp) {
		if (err) {
			return res.status(400).send({details: err.message});
		}
		try {
			var features = []
			for( var r in resp.results ) {
				var result = resp.results[r]
				var feature = {
					'type': 'Feature',
					'properties': {},
					'geometry': result.data_geometry
				}
				delete result.data_geometry
				var keys = Object.keys(result)
				for( var k in keys) { 
					feature.properties[keys[k]] = result[keys[k]]
				}
				features.push(feature)
			}
			resp.type 		= 'FeatureCollection'
			resp.features 	= features
			delete resp.results
			return res.send(resp);
		} catch(e) {
			console.log(e)
		}
	});
};

function slack( satellite, req, res) {	
	console.log("slack")
	console.log(req.body)
	
	var token 	= req.body.token
	
	if( token != process.env.SLACK_VERIFICATION_TOKEN) {
		console.log("Invalid Token", token, process.env.SLACK_VERIFICATION_TOKEN)
		return res.sendStatus(404)
	}
	
	var text 	= req.body.text
	var host 	= req.protocol + '://' + req.get('host')
		
	var params	= text.split(' ')
	console.log(params)
	
	if (params[0] == 'search') {
		req.query['search'] = params[1]			// Legacy Search
		req.query['fields'] = 'scene_id'
		req.query['limit']	= 25
		
		if( params.length > 2) {
			i = 2
			while( i < params.length ) {
				var parr 		= params[i].split('=')
				var key			= parr[0]
				var value		= parr[1]
				console.log("setting", key. value)
				req.query[key] 	= value
				i++
			}
		}
		var s = new api(req);			
		s[satellite](function (err, resp) {
			console.log(err, resp)
			var text = "No scenes found!"
		
			if(!err ) {
				text = 'found:' + resp.meta.found + " limit:"+req.query['limit']+"\n"
				for( var r in resp.results ) {
					var feature = resp.results [r]
					var url = "<"+host + "/show/"+feature.scene_id + "|show me>"
					text += "\tscene:\t"+feature.scene_id + " " + url +"\n"
				}
			} 
			var data = {
				text: text
			}
			res.json(data)
		})		
	} else if(params[0] == 'help') {
		text = "Slack Command Help:\n"
		text += "\t/search EO1* | search <city> | search <q> limit=5 \n"
		var data = {
			text: text
		}
		res.json(data)		
	}else {
		res.send('Invalid query term', text)
	}
}

module.exports = {
	eo1_geoquery: function(req,res) {
		return geoquery('eo1', req, res)
	},
	
	eo1_query: function(req, res) {
		console.log("eo1_query")
		return 	search("eo1", req,res)
	},
	
	landsat_query: function(req, res) {
		return 	getDevelopmentSeed("landsat", req,res)
	},
	
	sentinel_query: function(req, res) {
		return 	getDevelopmentSeed("sentinel", req,res)
	},
	
	count: function(req, res) {
		return search('count', req, res);
	},
	
	geojson: function(req, res) {
		return search('geojson', req, res);
	},
	
	health: function(req, res) {
		return search('health', req, res);
	},
	
	eo1_slack: function(req, res) {
		return slack('eo1', req, res);
	},
	actions: function(req, res) {
		console.log("action", req.body)
		return res.sendStatus(200)
	}
}