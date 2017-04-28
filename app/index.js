require('envloader').load();
var express 		= require('express');
var cors 			= require('cors');
var bodyParser 		= require('body-parser');
var compression 	= require('compression');
var app 			= express();
var https 			= require("https");
var request			= require('request');
var engines 		= require('consolidate');

var elastic_search 	= require('./search.js');
var processing 		= require('./process');
var slack 			= require('./slack');
var assert			= require('assert');
var path			= require('path');

// Check ENVIRONMENT VARIABLES
assert(process.env.SLACK_VERIFICATION_TOKEN, "Missing SLACK_VERIFICATION_TOKEN ENV")
assert(process.env.ES_HOST, "Missing ES_HOST ENV")
assert(process.env.ES_PORT, "Missing ES_PORT ENV")
//assert(process.env.NAME, "Missing NAME ENV")
//assert(process.env.WEBSITE, "Missing WEBSITE ENV")

var appRoot;

if (process.env.NODE_ENV == 'development') {
	appRoot = process.env.PWD;
} else {
	appRoot = "/tmp"
}
console.log("appRoot",appRoot)

/*----------------------------------
// START MIDDLEWARES
----------------------------------*/
app.use(cors());
app.use(compression())

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }))

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
	
		res.render("search.ejs", {
			id: 	id,
			host: host,
			data: data
	    })		
	
});

app.get('/process/:id/:algorithm', function(req, res) {
	var id 			= req.params['id']
	var algorithm 	= req.params['algorithm']
	var host		= req.protocol + '://' + req.get('host')
	
		res.render("process_algorithm.ejs", {
			id: 	id,
			algorithm: algorithm,
			host: host
	    })		
});

app.get('/process/:id', function(req, res) {
	var id 			= req.params['id']
	var host		= req.protocol + '://' + req.get('host')
	
  //search('eo1', req, res);
  res.render("process.ejs", {
	  id: 	id,
	  host: host
  })
});

app.get('/sendFile/:id', function(req, res) {
	var id 			= req.params['id']
	var host		= req.protocol + '://' + req.get('host')
	
	var year		= id.substring(10,14)
	var doy			= id.substring(14,17)
	var baseName	= path.basename(id, ".png")
	var productName	= path.join(appRoot, "tmp", year, doy, baseName, id) 

    res.sendFile( productName)
});

app.get('/product/:id', function(req, res) {
	var id 			= req.params['id']
	var host		= req.protocol + '://' + req.get('host')
	
//	var year		= scene.substring(10,14)
//	var doy			= scene.substring(14,17)
//	var productName	= path.join(appRoot, "tmp", year, doy, id, id+".jpg") 

	res.render("product.ejs", {
		id: 	id,
		host: 	host,
		href: 	"/sendFile/"+id
	})
});

app.get('/show/:id', function(req, res) {
	var id 			= req.params['id']
	var url			= req.protocol + '://' + req.get('host') + req.originalUrl;	
	slack.searchPost( id, function(err, data) {
		res.render("show.ejs", {
			id: id,
			url: url,
			message: data
		})
	})
});

app.get('/sources/:id', function(req, res) {
	var id 		= req.params['id']
	var url		= req.protocol + '://' + req.get('host') + req.originalUrl;	
	var arr		= id.split("_")
	var scene	= arr[0]
	var level	= arr[1]
	var year	= scene.substring(10,14)
	var doy		= scene.substring(14,17)

	console.log("*sources", id)
	
	var url2	= "https://s3.amazonaws.com/eo1-hyperion/"+level+ "/" + year + "/" + doy +"/"
	url2 		+= scene + "/" + id +".json"
	
	console.log(url2)
//	var url2 = "https://s3.amazonaws.com/eo1-hyperion/L1U/2013/228/EO1H0110282013228110T3/EO1H0110282013228110T3_L1U.json"
	request.get(url2, function(err, response, body) {
		if(!err) {
			var data = JSON.parse(body)
			console.log(JSON.stringify(data.sources,0,'\t'))
		}
		res.render("sources.ejs", {
			id: id,
			url: url,
			scene_id: data.scene_id,
			sources: data.sources
		})
	})
});

app.get('/source/:id', function(req, res) {
	var id 		= req.params['id']
	var url		= req.protocol + '://' + req.get('host') + req.originalUrl;	
	var arr		= id.split("_")
	var scene	= arr[0]
	var level	= arr[1].split(".")[0]
	var year	= scene.substring(10,14)
	var doy		= scene.substring(14,17)

	console.log("*source", id)
	
	var url2	= "https://s3.amazonaws.com/eo1-hyperion/"+level+ "/" + year + "/" + doy +"/"
	url2 		+= scene + "/" + id
	
	console.log(url2)
//	var url2 = "https://s3.amazonaws.com/eo1-hyperion/L1U/2013/228/EO1H0110282013228110T3/EO1H0110282013228110T3_L1U.json"
	request.get(url2, function(err, response, body) {
		if(!err) {
			var data = JSON.parse(body)
			delete data.actions
			//console.log(JSON.stringify(data,0,'\t'))
		}
		res.render("source.ejs", {
			id: id,
			url: url,
			data: data
		})
	})
});

app.get('/download/:id', function(req, res) {
	var id 		= req.params['id']
	var url		= req.protocol + '://' + req.get('host') + req.originalUrl;	
	var arr		= id.split("_")
	var scene	= arr[0]
	var level	= arr[1]
	var year	= scene.substring(10,14)
	var doy		= scene.substring(14,17)

	console.log("*Download", id)
	
	var url2	= "https://s3.amazonaws.com/eo1-hyperion/"+level+ "/" + year + "/" + doy +"/"
	url2 		+= scene + "/" + id +".json"
	
	console.log(url2)
//	var url2 = "https://s3.amazonaws.com/eo1-hyperion/L1U/2013/228/EO1H0110282013228110T3/EO1H0110282013228110T3_L1U.json"
	request.get(url2, function(err, response, body) {
		if(!err) {
			//console.log(body)
			var data = JSON.parse(body)
		}
		res.render("download.ejs", {
			id: id,
			url: url,
			downloads: data.actions.downloads
		})
	})
	

});

app.get('/map/:id', function(req, res) {
	var id 		= req.params['id']
	var url		= req.protocol + '://' + req.get('host') + req.originalUrl;	
	res.render("show_map.ejs", {
		id: id,
		url: url
  	})
});

app.get('/map', function(req, res) {
	res.render("map.html")
});

app.get('/api', function(req, res) {
	res.redirect("/dist/index.html")
});

app.get('/slack-app', function(req, res) {
	res.render("slack.ejs", {
		
	})
});

app.get('/geoquery', 		elastic_search.eo1_geoquery);
app.get('/landsat', 		elastic_search.landsat_query);
app.get('/sentinel', 		elastic_search.sentinel_query);
app.get('/eo1', 			elastic_search.eo1_query);
app.post('/eo1/process', 	processing.index);
app.get('/count', 			elastic_search.count);
app.get('/geojson', 		elastic_search.geojson);
app.get('/health', 			elastic_search.health);
app.post('/slack', 			elastic_search.eo1_slack);
app.post('/slack/cmds', 	slack.cmds);
app.post('/slack/actions', 	slack.actions);
app.get('/slack/oauth', 	slack.oauth);
app.get('/slacksearch/:id', slack.search);
app.get('/slack/:id', 		slack.postMessage);

/*----------------------------------
// END ENDPOINTS
----------------------------------*/

var port = process.env.PORT || 8000;
app.listen(port, function() {
  console.log('Listening on ' + port);
});
