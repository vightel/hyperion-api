var sharp = require('sharp')

function composite(inputs, output, cb) {
		var alphaMask = sharp(inputs[0])
			.toColourspace('b-w')
			.normalize()
			.threshold(0)
			.png()
			.toBuffer()

		var greenPromise = sharp(inputs[1])
			.toColourspace('b-w')
			.normalize()
			.png()
			.toBuffer()	

		var bluePromise = sharp(inputs[2])
			.toColourspace('b-w')
			.normalize()
			.png()
			.toBuffer()	
		
		Promise.all([alphaMask, greenPromise, bluePromise])
			.then(function(results) {
				console.log("Generating RGB composite...")
				sharp(inputs[0])
				.normalize()
				.greyscale()
				.joinChannel([results[1], results[2], results[0]])
				.toColourspace(sharp.colourspace.srgb)
				.toFile(output, function(error, info) {
					console.log("join err", error, info)
					cb(error)
				})
			})
			.catch( function(error) {
				console.log("catch err", error)
				cb(error)
			})
}

module.exports.composite = composite