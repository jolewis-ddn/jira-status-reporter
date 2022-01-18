/** @format */

'use strict'

const config = require('config')
const path = require('path')
const fs = require('fs')
const debug = require('debug')('quickProgressQuery')

const ACCEPTED_FORMATS = ['json', 'html']
const DEFAULT_OUTPUT = 'output.html'
const DEFAULT_OUTPUT_FORMAT = 'html'

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
  .option('-o, --output <filename>', `Output file (default: ${DEFAULT_OUTPUT})`)
  .option('-f, --format <format>', 'Output format')
  .option(
    '-w, --week-report',
    'Run report for previous week (overrides -s and -e)'
  )
  .option(
    '-y, --yesterday',
    'Run report for yesterday (overrides -s, -e, and -w)'
  )
  .option('-v, --verbose', 'Show more details (including unchanged issue data)')

program.parse(process.argv)
const options = program.opts()

const outputFilename = options.output || DEFAULT_OUTPUT

const StoryStats = require('./StoryStats')
let storyStats
if (options.database) {
  storyStats = new StoryStats(options.database)
} else {
  storyStats = new StoryStats()
}

const componentList = storyStats.getComponentList(true)
if (options.component && !componentList.includes(options.component)) {
  console.error(`Invalid Component provided: ${options.component}`)
  process.exit(1)
}

let startDate
let endDate
let outputFormat =
  options.format || outputFilename
    ? outputFilename.endsWith('html')
      ? 'html'
      : 'json'
    : DEFAULT_OUTPUT_FORMAT

if (options.yesterday || options.weekReport) {
  let daysAgo = 8 // default to weekReport
  if (options.yesterday) {
    daysAgo = 2
  }
  // Formatting source: https://stackoverflow.com/a/37649046
  startDate = new Date(new Date() - 1000 * 60 * 60 * 24 * daysAgo)
    .toLocaleString('en-us', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    .replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2') // daysAgo
  endDate = new Date(new Date() - 1000 * 60 * 60 * 24 * 1)
    .toLocaleString('en-us', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    .replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2') // Yesterday
} else {
  startDate = options.startDate
  endDate = options.endDate
}

let optionsSelected = [
  `startDate: ${startDate}`,
  `endDate: ${endDate}`,
  `outputFilename: ${options.output || 'unset'}`,
]

if (options.output && outputFormat == 'html') {
  fs.writeFileSync(
    outputFilename,
    `${buildHtmlHeader(
      startDate,
      endDate
    )}<br>Options: <ul><li>${optionsSelected.join('</li><li>')}</ul>`,
    {
      encoding: 'utf8',
      flags: 'w',
    }
  )
}

const summaryReport = storyStats.getSummaryReport(
  startDate,
  endDate,
  options.component,
  options.release
)

if (options.output && outputFormat == 'html') {
  fs.writeFileSync(
    options.output,
    buildHtml('Summary', 'Summary', summaryReport),
    { encoding: 'utf8', flag: 'a' }
  )
}

Object.keys(summaryReport)
  .sort()
  .forEach((component) => {
    const componentData = summaryReport[component].changes
    if (componentData.length) {
      const outputFile = path.resolve(outputFilename)
      if (options.output && outputFormat == 'json') {
        fs.writeFileSync(
          outputFile,
          JSON.stringify(
            { component: component, changeData: componentData },
            null,
            2
          ),
          { encoding: 'utf8', flag: 'a' }
        )
      } else if (options.output && outputFormat == 'html') {
        fs.writeFileSync(
          outputFile,
          buildHtml(component, 'Updates', componentData),
          {
            encoding: 'utf8',
            flag: 'a',
          }
        )
      }
    }
    const addData = summaryReport[component].additions
    if (addData.length) {
      // console.table(addData)
      if (options.output) {
        const outputFile = path.resolve(options.output)
        if (outputFormat == 'json') {
          fs.writeFileSync(
            outputFile,
            JSON.stringify({ component: component, addData: addData }, null, 2),
            { encoding: 'utf8', flag: 'a' }
          )
        } else if (outputFormat == 'html') {
          fs.writeFileSync(
            outputFile,
            buildHtml(component, 'Additions', addData),
            { encoding: 'utf8', flag: 'a' }
          )
        }
      }
    }
  })

if (options.output && outputFormat == 'html') {
  fs.writeFileSync(options.output, htmlFooter, { encoding: 'utf8', flag: 'a' })
}

function buildHtmlHeader(startDate, endDate) {
  const title = `Jira Delta Report: ${startDate} to ${endDate}`
  return `<!doctype html><html lang="en"><head> <meta charset="utf-8"> <meta name="viewport" content="width=device-width, initial-scale=1"> <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous"><title>${title}</title>
  <style>
  h2::before {
    display: block;
    content: " ";
    margin-top: -85px;
    height: 85px;
    visibility: hidden;
    pointer-events: none;
  </style>
  </head><body><h1>${title}</h1><em>Stories updated or added (including cumulative Sub-Task effort estimates)</em>`
}

function buildHtml(component, type, data) {
  let anchor = `${component}-${type}`
  let output = `<h2 id="${anchor}">${
    component !== 'Summary' ? component : 'Component'
  }: ${type}</h2>`
  if (type == 'Summary') {
    let sumCount = 0
    let sumChanged = 0
    let sumCompleted = 0
    let sumTotal = 0
    let sumAddition = 0
    output += `<table class="table table-sm table-striped"><thead><tr><th>${[
      'Component',
      'Count',
      'Changed',
      'Completed',
      'Total',
      'Additions',
    ].join('</th><th>')}</th></tr>`
    output += `<tbody>`
    Object.keys(data)
      .sort()
      .forEach((item) => {
        sumCount += data[item].count
        sumChanged += data[item].changed
        sumCompleted += data[item].completed
        sumTotal += data[item].total
        sumAddition += data[item].additions.length
        output += `<tr><td>${
          data[item].changed > 0
            ? `<a href="#${item}-Updates">`
            : data[item].additions.length > 0
            ? `<a href="#${item}-Additions">`
            : ''
        }${item}</a></td><td>${data[item].count}</td><td>${
          data[item].changed
        }</td><td>${convertToDays(
          data[item].completed
        )}</td><td>${convertToDays(data[item].total)}</td><td>${
          data[item].additions.length
        }</td></tr>`
      })
    output += `<tr><td><em style="float:right;">Totals</em></td>
        <td>${sumCount}</td>
        <td>${sumChanged}</td>
        <td>${convertToDays(sumCompleted)}</td>
        <td>${convertToDays(sumTotal)}</td>
        <td>${sumAddition}</td>
        </tr>`
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
        convertToDays(addition.progress),
        convertToDays(addition.total),
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
      debug(
        `typeof(update.total): ${typeof update.total}`,
        update.total,
        update.total.length
      )
      output += `<tr><th>${[
        `<a href="${config.jira.protocol}:${config.jira.host}/browse/${update.key}" target="_blank" rel="noreferrer noopener">${update.key}</a>`,
        tidyChangeCell(update.dates),
        tidyChangeCell(update.progress),
        tidyChangeCell(update.status),
        tidyChangeCell(update.total),
        tidyChangeCell(update.fixVersion),
      ].join('</td><td>')}</td></tr>`
    })
  }
  output += `</tbody>`
  output += `</table>`
  return output
}

function tidyChangeCell(content) {
  if (typeof content == typeof []) {
    return content
      .map((x) => {
        return convertToDays(x, true)
      })
      .join(' &#10132; ')
  } else {
    return `<span style='color: #aaa'>${convertToDays(content)}</span>`
  }
}

function convertToDays(val, tiered = false) {
  if (typeof val == typeof 0) {
    if (val === 0) {
      return val
    }

    let dayVal = 1 * (val / 28800).toFixed(2)

    if (dayVal == dayVal.toFixed(0)) {
      dayVal = +dayVal.toFixed(0)
    }
    if (tiered) {
      if (val >= 144000) {
        let weekVal = dayVal / 5
        if (weekVal == weekVal.toFixed(0)) {
          weekVal = +weekVal.toFixed(0)
        } else {
          weekVal = +weekVal.toFixed(2)
        }
        return weekVal + ' w'
      } else if (val >= 28800) {
        return dayVal + ' d'
      } else if (val >= 3600) {
        let hourVal = 1 * (dayVal * 8).toFixed(2)
        if (hourVal == hourVal.toFixed(0)) {
          hourVal = +hourVal.toFixed(0)
        }
        return hourVal + ' h'
      } else {
        return val.toFixed(2) + ' min'
      }
    } else {
      return dayVal + ' d'
    }
  } else {
    return val
  }
}
