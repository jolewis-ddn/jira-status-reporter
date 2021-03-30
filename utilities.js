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

exports.padToTwoCharacters = padToTwoCharacters;
