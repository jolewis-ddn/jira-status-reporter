/** @format */

'use strict'

const config = require('config')
const path = require('path')
const debug = require('debug')('quickProgressQuery')
const { Command } = require('commander')
const program = new Command()
program.version('0.0.1')

program
  .option('-d, --database <filename>', 'Database filename')
  .option('-r, --release <name>', 'Limit results to specified release string')
  .option('-c, --component <name>', 'Limit results to specified Component name')
  .option('-s, --start-date <date>', 'Starting date (YYYY-MM-DD)')
  .option('-e, --end-date <date>', 'Ending date (YYYY-MM-DD)')
  .option('-v, --verbose', 'Show more details (including unchanged issue data)')

program.parse(process.argv)
const options = program.opts()

const dbFilename =
  options.database || `${config.dataPath}${path.sep}jira-stats.db`

const releaseFilter = options.release
  ? ` AND fixVersion='${options.release}'`
  : ''

const db = require('better-sqlite3')(dbFilename, { readonly: true })
const startDate = options.startDate || '2021-07-18'
const endDate = options.endDate || '2021-07-25'
const sql = `select * from 'story-stats' where ( date='${endDate}' and key in (select key from 'story-stats' where date='${startDate}' ${releaseFilter})) or (date='${startDate}' ${releaseFilter}) order by key,date ASC`
console.log(`SQL: ${sql}`)

const stmt = db.prepare(sql)
const rows = stmt.all()

const results = {}
const componentsFound = []

let prevRow, prevKey
let processRow = false

rows.forEach((row) => {
  processRow = row.key == prevKey

  if (processRow) {
    let components = ['none']
    if (row.component) {
      components = row.component.split(',')
    }

    components.forEach((component) => {
      if (!componentsFound.includes(component)) {
        componentsFound.push(component)
      }

      if (
        !options.component ||
        (options.component && component == options.component)
      ) {
        if (!Object.keys(results).includes(component)) {
          results[component] = {
            count: 0,
            changed: 0,
            completed: 0,
            total: 0,
            data: [],
          }
        }

        results[component].count++
        if (row.total !== prevRow.total || row.progress !== prevRow.progress) {
          results[component].changed++
        }
        results[component].completed += row.progress - prevRow.progress
        results[component].total += row.total

        // Change in data
        if (
          prevRow.progress !== row.progress ||
          prevRow.total !== row.total ||
          prevRow.status !== row.status ||
          prevRow.fixVersion !== row.fixVersion
        ) {
          results[component].data.push({
            key: row.key,
            dates: [prevRow.date, row.date],
            progress:
              prevRow.progress == row.progress
                ? row.progress
                : [prevRow.progress, row.progress],
            status:
              prevRow.status == row.status
                ? row.status
                : [prevRow.status, row.status],
            total:
              prevRow.total == row.total
                ? row.total
                : [prevRow.total, row.total],
            fixVersion:
              prevRow.fixVersion == row.fixVersion
                ? row.fixVersion
                : [prevRow.fixVersion, row.fixVersion],
          })
        }
      }
    })
  }
  prevRow = row
  prevKey = row.key
})

let cleanResults = {}
let data = {}
if (options.component) {
  if (results[options.component]) {
    if (results[options.component].data.length > 0) {
      data = results[options.component]['data']
    }
  } else {
    console.error(`Couldn't find component: ${options.component}`)
    console.error(`Available components: \n\t${componentsFound.sort().filter(x => x !== 'none').join(`\n\t`)}`)
    process.exit(1)
  }
}

Object.keys(results)
  .sort()
  .forEach((component) => {
    cleanResults[component] = results[component]
    delete cleanResults[component][`data`]
  })

console.table(cleanResults)
if (options.component) {
  console.table(data)
}

console.log(`Done`)

function convertToHours(progress) {
  let hours = 0
  if (progress > 0) {
    hours = Math.round((100 * progress) / (60 * 60 * 8)) / 100
    // debug(`${progress} to ${hours}`)
  }
  return hours
}

const StoryStats = require('./StoryStats')
const storyStats = new StoryStats()
// console.log(storyStats.getComponentList(true))
console.table(storyStats.getSummaryReport(options.startDate, options.endDate, options.component, options.release))
