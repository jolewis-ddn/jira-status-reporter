'use strict';

const config = require('config')
const path = require('path')
const debug = require('debug')('quickProgressQuery')
const { Command } = require('commander')
const program = new Command()
program.version('0.0.1')

program
    .option('-d, --database <filename>', 'Database filename')
    .option('-r, --release <name>', 'Limit results to specified release string')
    .option('-s, --start-date <date>', 'Starting date (YYYY-MM-DD)')
    .option('-e, --end-date <date>', 'Ending date (YYYY-MM-DD)')

program.parse(process.argv)
const options = program.opts()

const dbFilename = options.database || `${config.dataPath}${path.sep}jira-stats.db`

const releaseFilter = options.release ? ` AND fixVersion='${options.release}'` : ''

const db = require('better-sqlite3')(dbFilename, { readonly: true })
const startDate = options.startDate || '2021-07-18'
const endDate = options.endDate || '2021-07-25'
const sql = `select * from 'story-stats' where ( date='${endDate}' and key in (select key from 'story-stats' where date='${startDate}' ${releaseFilter})) or (date='${startDate}' ${releaseFilter}) order by key,date ASC`
debug(`SQL: ${sql}`)

const stmt = db.prepare(sql)

const rows = stmt.all()

const results = {}

let prevRow, prevKey
let processRow = false

rows.forEach(row => {
    processRow = row.key == prevKey

    // debug(row.key, row.date, row.component, row.progress, row.total, processRow)
    
    if (processRow) {
        let components = ['none']
        if (row.component) {
            components = row.component.split(',')
        }

        components.forEach((component) => {
            if (!Object.keys(results).includes(component)) {
                results[component] = { 
                    count: 0,
                    changed: 0,
                    completed: 0,
                    total: 0,
                    data: []
                }
            }

            results[component].count++
            if (row.total !== prevRow.total || row.progress !== prevRow.progress) {
                results[component].changed++
            }
            results[component].completed += (row.progress - prevRow.progress)
            results[component].total += row.total
            results[component].data.push(prevRow)
            results[component].data.push(row)
        })
    }
    prevRow = row
    prevKey = row.key
})

let cleanResults = {}
Object.keys(results).sort().forEach((component) => {
    cleanResults[component] = results[component]
    delete cleanResults[component][`data`]
})

debug(cleanResults)

console.log(`Done`)

// console.log(results)
