/** @format */

'use strict'

const config = require('config')
const debug = require('debug')('quickProgressQuery')

const DEFAULT_DAYS = 8

const htmlFooter = `<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/js/bootstrap.bundle.min.js" integrity="sha384-MrcW6ZMFYlzcLA8Nl+NtUVF0sA7MsXsP1UyJoMp4YLEuNSfAP+JcXn/tWtIaxVXM" crossorigin="anonymous"></script>

  </body>
</html>`

const StoryStats = require('./StoryStats')
let storyStats = new StoryStats()

const componentList = storyStats.getComponentList(true)

function buildReport(daysAgo) {
  debug(`buildReport(${daysAgo}) starting...`)
  let startDate
  let endDate
  // let daysAgo = 8 //  weekReport

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

  debug(
    `@43 ==> startDate: ${startDate} (orig: ${new Date(
      new Date() - 1000 * 60 * 60 * 24 * daysAgo
    ).toLocaleString('en-us', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })}; raw: ${new Date(
      new Date() - 1000 * 60 * 60 * 24 * daysAgo
    )}; daysAgo: ${daysAgo}); endDate: ${endDate}`
  )

  const summaryReport = storyStats.getSummaryReport(
    startDate,
    endDate,
    '',
    'RED 1.0 Software'
  )

  let resp = `${buildHtmlHeader(startDate, endDate)}${buildHtml(
    'Summary',
    'Summary',
    summaryReport
  )}`

  debug('resp set')

  debug(`Components found: ${Object.keys(summaryReport).sort().join(', ')}`)
  Object.keys(summaryReport)
    .sort()
    .forEach((component) => {
      debug(`Processing component: ${component}`)
      const componentData = summaryReport[component].changes
      if (componentData.length) {
        resp += buildHtml(component, 'Updates', componentData)
      }
      const addData = summaryReport[component].additions
      if (addData.length) {
        debug(`addData processing...`)
        resp += buildHtml(component, 'Additions', addData)
      }
    })

  resp += htmlFooter
  return resp
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
  debug(`buildHtml(${component}, ${type}, data)...`)

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
        debug(`Writing summary output for ${item}`)

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

// Server
const fastify = require('fastify')({
  logger: true,
})

fastify.get('/days/:days', async (request, reply) => {
  reply.type('text/html')
  debug(`days: `, request.params)
  let days = request.params.days || DEFAULT_DAYS
  return buildReport(days)
})

fastify.get('/:days', async (request, reply) => {
  reply.type('text/html')
  debug(`days: `, request.params)
  let days = request.params.days || DEFAULT_DAYS
  return buildReport(days)
})

const start = async () => {
  try {
    await fastify.listen(9587, '0.0.0.0')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()
