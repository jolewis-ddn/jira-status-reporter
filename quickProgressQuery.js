/** @format */

'use strict'

const config = require('config')
const path = require('path')
const fs = require('fs')
const debug = require('debug')('quickProgressQuery')

const ACCEPTED_FORMATS = ['json', 'html']

const htmlFooter = `<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/js/bootstrap.bundle.min.js" integrity="sha384-MrcW6ZMFYlzcLA8Nl+NtUVF0sA7MsXsP1UyJoMp4YLEuNSfAP+JcXn/tWtIaxVXM" crossorigin="anonymous"></script>

  </body>
</html>`

const { Command } = require('commander')
const program = new Command()
program.version('0.0.1')

program
  .option('-d, --database <filename>', 'Database filename')
  .option('-r, --release <name>', 'Limit results to specified release string')
  .option('-c, --component <name>', 'Limit results to specified Component name')
  .option('-s, --start-date <date>', 'Starting date (YYYY-MM-DD)')
  .option('-e, --end-date <date>', 'Ending date (YYYY-MM-DD)')
  .option('-o, --output <filename>', 'Output file')
  .option('-f, --format <format>', 'Output format')
  .option('-w, --week-report', 'Run report for previous week (overrides -s and -e)')
  .option('-v, --verbose', 'Show more details (including unchanged issue data)')

program.parse(process.argv)
const options = program.opts()

const StoryStats = require('./StoryStats')
const storyStats = new StoryStats()

const componentList = storyStats.getComponentList(true)
if (options.component && !componentList.includes(options.component)) {
  console.error(`Invalid Component provided: ${options.component}`)
  process.exit(1)
}

let startDate
let endDate

if (options.weekReport) {
  // Formatting source: https://stackoverflow.com/a/37649046
  startDate = new Date(new Date()-(1000*60*60*24*8)).toLocaleString('en-us', {year: 'numeric', month: '2-digit', day: '2-digit'}).
  replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2') // yesterday
  endDate = new Date(new Date()-(1000*60*60*24*1)).toLocaleString('en-us', {year: 'numeric', month: '2-digit', day: '2-digit'}).
  replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2') // 8 days ago
} else {
  startDate = options.startDate
  endDate = options.endDate
}

debug(`startDate: ${startDate}; endDate: ${endDate}`)

if (options.output && options.format == "html") { 
  fs.writeFileSync(options.output, buildHtmlHeader(startDate, endDate), { encoding: 'utf8', flags: 'w' })
}

const summaryReport = storyStats.getSummaryReport(
  startDate,
  endDate,
  options.component,
  options.release
)

// console.table(summaryReport)

if (options.output && options.format == "html") { 
  fs.writeFileSync(options.output, buildHtml("Summary", "Summary", summaryReport), { encoding: 'utf8', flag: 'a' })
}

Object.keys(summaryReport).sort().forEach((component) => {
  const componentData = summaryReport[component].changes
  // console.log(
  //   `Issue${
  //     componentData.length == 1 ? '' : 's'
  //   } updated for Component ${component}: ${
  //     componentData.length == 0 ? 'None' : ''
  //   }`
  // )
  if (componentData.length) {
    // console.table(componentData)
    const outputFile = path.resolve(options.output)
    if (options.format == 'json') {
      fs.writeFileSync(
        outputFile,
        JSON.stringify({ component: component, changeData: componentData }, null, 2),
        { encoding: 'utf8', flag: 'a' }
      )
    } else if (options.format == 'html') {
      fs.writeFileSync(outputFile, buildHtml(component, 'Updates', componentData), {
        encoding: 'utf8',
        flag: 'a',
      })
    }
  }
  const addData = summaryReport[component].additions
  // console.log(
  //   `Issue${addData.length == 1 ? '' : 's'} added for Component ${component}: ${
  //     addData.length == 0 ? 'None' : ''
  //   }`
  // )
  if (addData.length) {
    // console.table(addData)
    if (options.output) {
      const outputFile = path.resolve(options.output)
      if (options.format == 'json') {
        fs.writeFileSync(
          outputFile,
          JSON.stringify({ component: component, addData: addData }, null, 2),
          { encoding: 'utf8', flag: 'a' }
        )
      } else if (options.format == 'html') {
        fs.writeFileSync(
          outputFile,
          buildHtml(component, 'Additions', addData),
          { encoding: 'utf8', flag: 'a' }
        )
      }
    }
  }
})

if (options.output && options.format == "html") { 
  fs.writeFileSync(options.output, htmlFooter, { encoding: 'utf8', flag: 'a' })
}

function buildHtmlHeader(startDate, endDate) {
  const title = `Jira Delta Report: ${startDate} to ${endDate}`
  return(`<!doctype html><html lang="en"><head> <meta charset="utf-8"> <meta name="viewport" content="width=device-width, initial-scale=1"> <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous"><title>${title}</title>
  <style>
  h2::before {
    display: block;
    content: " ";
    margin-top: -85px;
    height: 85px;
    visibility: hidden;
    pointer-events: none;
  </style>
  </head><body><h1>${title}</h1><em>Stories updated or added (including cumulative Sub-Task effort estimates)</em>`)
}

function buildHtml(component, type, data) {
  let anchor = `${component}-${type}`
  let output = `<h2 id="${anchor}">${component !== "Summary" ? component : "Component"}: ${type}</h2>`
  if (type == 'Summary') {
    output += `<table class="table table-sm table-striped"><thead><tr><th>${[
      'Component',
      'Count',
      'Changed',
      'Completed',
      'Total',
      'Additions'
    ].join('</th><th>')}</th></tr>`
    output += `<tbody>`
    Object.keys(data).sort().forEach((item) => {
      output += `<tr><td>${data[item].changed > 0 ? `<a href="#${item}-Updates">` : data[item].additions.length > 0 ? `<a href="#${item}-Additions">` :''}${item}</a></td><td>${data[item].count}</td><td>${data[item].changed}</td><td>${data[item].completed}</td><td>${data[item].total}</td><td>${data[item].additions.length}</td></tr>`
    })
  } else if (type == 'Additions') {
    output += `<table class="table table-sm table-striped"><thead><tr><th>${[
      'Key',
      'Date',
      'Status',
      'fixVersion',
      'Component',
      'Progress',
      'Total',
    ].join('</th><th>')}</th></tr>`
    output += `<tbody>`
    data.forEach((addition) => {
      output += `<tr><th>${[
        `<a href="${config.jira.protocol}:${config.jira.host}/browse/${addition.key}" target="_blank" rel="noreferrer noopener">${addition.key}</a>`,
        addition.date,
        addition.status,
        addition.fixVersion,
        addition.component,
        addition.progress,
        addition.total,
      ].join('</td><td>')}</td></tr>`
    })
  } else if (type == 'Updates') {
    output += `<table class="table table-sm table-striped"><thead><tr><th>${[
      'Key',
      'Dates',
      'Progress',
      'Status',
      'Total',
      'fixVersion',
    ].join('</th><th>')}</th></tr>`
    output += `<tbody>`
    data.forEach((update) => {
      output += `<tr><th>${[
        `<a href="${config.jira.protocol}:${config.jira.host}/browse/${update.key}" target="_blank" rel="noreferrer noopener">${update.key}</a>`,
        update.dates,
        update.progress,
        update.status,
        update.total,
        update.fixVersion,
      ].join('</td><td>')}</td></tr>`
    })
  }
  output += `</tbody>`
  output += `</table>`
  return(output)
}
