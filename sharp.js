var sharp 	= require('sharp')
var path	= require('path')
var fs		= require('fs')

var dirName = "./tmp/2013/228/EO1H0110282013228110T3_L1U_COMPOSITE_B26_B20_B12"
var redFileName		= path.join(dirName, "EO1H0110282013228110T3_B026_L1U.TIF")
var greenFileName	= path.join(dirName, "EO1H0110282013228110T3_B020_L1U.TIF")
var blueFileName	= path.join(dirName, "EO1H0110282013228110T3_B012_L1U.TIF")

var outFileName		= path.join(dirName, "EO1H0110282013228110T3_RGB_L1U.png")
var outFileName2	= path.join(dirName, "test.jpg")
var maskFileName	= path.join(dirName, "mask.png")

console.log("Red", redFileName)

console.log("Making RGB...", outFileName)

try {
		
	var alphaMask = sharp(redFileName)
		.toColourspace('b-w')
		.normalize()
//		.greyscale()
//		.negate()
		.threshold(0)
		.png()
		.toBuffer()
//		.toFile(maskFileName, function(err, info) {
//			console.log("masked", err, info)
//		})
		
//	var redPromise = sharp(redFileName)
//		.toColourspace('b-w')
//		.extractChannel(1)
//		.greyscale()
//		.bandbool(sharp.bool.and)
//		.png()
//		.toBuffer()	

	var greenPromise = sharp(greenFileName)
		.toColourspace('b-w')
		.normalize()
//		.greyscale()
		.png()
		.toBuffer()	

	var bluePromise = sharp(blueFileName)
		.toColourspace('b-w')
		.normalize()
//		.greyscale()
		.png()
		.toBuffer()	
		
	Promise.all([alphaMask, greenPromise, bluePromise])
		.then(function(results) {
			console.log("All bands ready!", results.length)
			sharp(redFileName)
//			.toColourspace('b-w')
			.normalize()
			.greyscale()
			.joinChannel([results[1], results[2], results[0]])
			.toColourspace(sharp.colourspace.srgb)
			.toFile(outFileName2, function(error, info) {
				console.log("join err", error, info)
			})
		})
		.catch( function(error) {
			console.log("catch err", error)
		})
	//var greenimg 	= sharp(greenFileName)
	//var blueimg 	= sharp(blueFileName)
	
	//sharp()
	//.toColorspace('sRGB')
	//.joinChannel([redFileName, greenFileName, blueFileName])
	//.png()
	//.toFile(outFileName2, function(err, info) {
	//	console.log("toFile", err, info)
	//})
} catch (e) {
	console.log("Exception", e)
}