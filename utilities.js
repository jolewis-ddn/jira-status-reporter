const debug = require('debug')('utilities')

function padToTwoCharacters(x, padWithChar = "0") {
    debug(`padToTwoCharacters(${x}, ${padWithChar}) called...`)
    if (x.toString().length < 2) {
        debug(`...returning ${padWithChar.concat(x)}`)
        return(padWithChar.concat(x))
    } else {
        return(x)
    }
}

/*
 * Calculate moving average
 * Uses forEach loop
 * Slightly more performant for smaller periods 
 */
function calcMovingAverage(arr, per, emptyVal = 0) {
	if (arr.length <= per) {
		throw new Error(`Array must be longer than the period ${per}. Supplied array is only ${arr.length} elements.`)
	}
	console.time('calcMovingAverage')
	let ndx = -1
	let resp = []
	arr.forEach((n) => {
		ndx++
		if (ndx >= per-1) {
			resp.push(arr.slice(ndx-per+1, ndx+1).reduce((a,c) => a+c)/per)
		} else {
			resp.push(emptyVal)
		}
	})
	console.timeEnd('calcMovingAverage')
	return(resp)
}

function tagCache(c, ttl = 0) {
	if (c.cache && c.cache.status) { // Not stamped yet
		c.cache.status = "used"
	}
	return(c)
}

const CACHE_TTL = 600

exports.CACHE_TTL = CACHE_TTL;
exports.tagCache = tagCache;
exports.padToTwoCharacters = padToTwoCharacters;
exports.calcMovingAverage = calcMovingAverage;
