/** @format */

const debug = require('debug')('jiraUtils')

// Convert seconds into days
function convertSecondsToDays(sec) {
  let result = (sec / 28800).toFixed(2)
  if (result == Math.round(result)) {
    result = Math.round(result)
  }
  return +result
}

function removeSpaces(x) {
  return x.replace(/\s/g, '_')
}

/**
 *Return a list of incoming and outgoing links
 *
 * @param {JSON} linkData from Rest
 * @param {boolean} makeActive Convert all to active relationships
 * @returns {Object} Summary
 *  [
 *    "in": [
 *      { }
 *    ],
 *    "out": [
 *    ]
 *  ]
 */
function summarizeLinks(linkData, makeActive = false, baseKey = false) {
  let links = []
  if (makeActive) {
    linkData.forEach((l) => {
      if (Object.keys(l).includes('outwardIssue')) {
        // "Passive" relationship... convert to "Active"
        links.push([baseKey, l.outwardIssue.key, l.type.outward])
      } else if (Object.keys(l).includes('inwardIssue')) {
        // "Active" relationship... no change
        links.push([l.inwardIssue.key, baseKey, l.type.outward])
      } else {
        console.error(`Invalid link type: ${l.key}`)
      }
    })
  } else {
    // makeActive == false
    links = { in: [], out: [] }
    linkData.forEach((l) => {
      if (Object.keys(l).includes('inwardIssue')) {
        links.in.push({
          type: l.type.inward,
          source: l.inwardIssue.key,
        })
      } else if (Object.keys(l).includes('outwardIssue')) {
        links.out.push({
          type: l.type.outward,
          target: l.outwardIssue.key,
        })
      } else {
        console.error(`Invalid link type: ${l.key}`)
      }
    })
  } // if makeActive

  return links ? links : ''
}

function convertTimestampToElapsedDays(timestampStr) {
  try {
    let result =
      Math.round(
        (new Date().getTime() - new Date(timestampStr).getTime()) /
          (60 * 60 * 24 * 10)
      ) / 100
    // console.log(result)
    return result
  } catch (err) {
    throw err
  }
}

exports.convertSecondsToDays = convertSecondsToDays
exports.removeSpaces = removeSpaces
exports.summarizeLinks = summarizeLinks
exports.convertTimestampToElapsedDays = convertTimestampToElapsedDays
