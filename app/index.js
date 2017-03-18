require('envloader').load();
var express = require('express');
var cors = require('cors');
var bodyParser = require('body-parser');
var compression = require('compression');
var api = require('sat-api-lib');
var app = express();
var https = require("https");
var request=require('request');
var engines = require('consolidate');

var geoquery = function (action, req, res) {
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

var search = function (action, req, res) {
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

/*----------------------------------
// START MIDDLEWARES
----------------------------------*/
app.use(cors());
app.use(compression())
app.use(bodyParser.json({ type: 'application/json' })); // for parsing application/json
app.use(function(err, req, res, next) {
  console.error(err.stack);
  if (err.status === 400 && err.name === 'SyntaxError' && err.body) {
    res.status(err.status).send({details: 'Invalid JSON'})
  }

  res.status(err.status).send({details: err.body.slice(0, 100).toString()});
});

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Accept, api_key, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, PUT, PATCH, OPTIONS");
  next();
});
/*----------------------------------
// END MIDDLEWARES
----------------------------------*/
app.use(express.static('public'))

app.set('views', __dirname + './../views');
app.engine('html',  require('ejs').renderFile);
app.set('view engine', 'html');


app.get('/', function(req, res) {
  //search('eo1', req, res);
  res.render("home.html")
});

app.get('/search', function(req, res) {
	var id 		= null
	var host	= req.protocol + '://' + req.get('host')
	
  //search('eo1', req, res);
  res.render("search.ejs", {
	  id: 	id,
	  host: host
  })
});

app.get('/search/:id', function(req, res) {
	var id 		= req.params['id']
	var host	= req.protocol + '://' + req.get('host')
	
  //search('eo1', req, res);
  res.render("search.ejs", {
	  id: 	id,
	  host: host
  })
});

app.get('/process/:id', function(req, res) {
	var id 		= req.params['id']
	var host	= req.protocol + '://' + req.get('host')
	
  //search('eo1', req, res);
  res.render("process.ejs", {
	  id: 	id,
	  host: host
  })
});

app.get('/show/:id', function(req, res) {
	var id 		= req.params['id']
	var url		= req.protocol + '://' + req.get('host') + req.originalUrl;	
	res.render("show.ejs", {
		id: id,
		url: url
  })
});

app.get('/download/:id', function(req, res) {
	var id 		= req.params['id']
	var url		= req.protocol + '://' + req.get('host') + req.originalUrl;	
	var scene	= id.split("_")[0]
	var year	= scene.substring(10,14)
	var doy		= scene.substring(14,17)
	
	var url2	= "https://s3.amazonaws.com/eo1-hyperion/L1U/" + year + "/" + doy +"/"
	url2 		+= scene + "/" + id +".json"
//	console.log(url2)
//	var url2 = "https://s3.amazonaws.com/eo1-hyperion/L1U/2013/228/EO1H0110282013228110T3/EO1H0110282013228110T3_L1U.json"
	request.get(url2, function(err, response, body) {
		if(!err) {
			var data = JSON.parse(body)
		}
		res.render("download.ejs", {
			id: id,
			url: url,
			downloads: data.actions.downloads
		})
	})
	

});

app.get('/map', function(req, res) {
  //search('eo1', req, res);
  res.render("map.html")
});

app.get('/api', function(req, res) {
  res.redirect("/dist/index.html")
});

app.get('/geoquery', function(req, res) {
    geoquery('eo1', req, res);
});

//app.post('/', function (req, res) {
//  search('eo1', {query: req.body}, res);
//});

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

app.get('/landsat', function(req, res) {
	getDevelopmentSeed("landsat", req,res)
});

//app.post('/landsat', function (req, res) {
//  search('landsat', {query: req.body}, res);
//});

app.get('/sentinel', function(req, res) {
	getDevelopmentSeed("sentinel", req,res)
});

//app.post('/sentinel', function (req, res) {
//  search('sentinel', {query: req.body}, res);
//});

app.get('/eo1', function(req, res) {
  search('eo1', req, res);
});

app.get('/eo1/process', function(req, res) {
  res.send("NOT IMPLEMENTED YET")
});

//app.post('/eo1', function (req, res) {
//  search('eo1', {query: req.body}, res);
//});


app.get('/count', function(req, res) {
  search('count', req, res);
});

app.get('/geojson', function(req, res) {
  search('geojson', req, res);
});

//app.post('/geojson', function(req, res) {
//  search('geojson', {query: req.body}, res);
//});

app.get('/health', function(req, res) {
  search('health', req, res);
});
/*----------------------------------
// END ENDPOINTS
----------------------------------*/

var port = process.env.PORT || 8000;
app.listen(port, function() {
  console.log('Listening on ' + port);
});
