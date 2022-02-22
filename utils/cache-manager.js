/** @format */

/**
 * Small utility file to update the cache from the command line
 */

const fs = require('fs')
const { basename } = require('path')
const debug = require('debug')('cache-manager')

const JDR = require('../JiraDataReader')
let jdr = new JDR()

const filename = process.argv.splice(2).join('')
debug(`filename: ${filename}; basename = ${basename(filename)}`)
const status = basename(filename, '.json').split('-')
const filedate = status.splice(1).join('-')
debug(`filedate: ${filedate}; status: ${status}`)

const STATUSES = {
  'IN REVIEW': 'In Review',
  'IN PROGRESS': 'In Progress',
  BLOCKED: 'Blocked',
  ICEBOX: 'Icebox',
}

async function go() {
  if (filedate && filedate.length == 10 && status && status.length) {
    if (filename && fs.existsSync(filename)) {
      debug(`Processing ${filename} / ${filedate}`)
      await jdr.wipeCacheDatabase(filedate, STATUSES[status])
      jdr._processFile(filename)
    } else {
      console.error(`Missing or invalid filename provided: ${filename}`)
    }
  } else {
    console.error(
      `Missing or invalid filedate (${filedate}) or status (${status}) - could not parse filename ${filename}`
    )
  }
}

go()
