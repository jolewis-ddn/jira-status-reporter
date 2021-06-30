/**
 * Input format:
 *     http://localhost:9292/query?jql=parentEpic=RED-1234&fields=summary&fields=issuelinks&fields=progress&fields=aggregateprogress&fields=status&changes=yes
 *
 * @format
 */

const debug = require('debug')('summarizer-cli')
const d = require('./dateExtension')
const got = require('got')
const config = require('config')

const fs = require('fs')
const Stream = require('stream')
const writeStream = new Stream.Writable()

const { Command } = require('commander')
const program = new Command()
program.version('0.0.1')

program
  .option('-p, --parent <parent_id>', 'Jira issue parent id/key')
  .option('-h, --host <hostname>', 'JSR server host')
  .option('-f, --input-file <filename>', 'Input JSON filename')
  .option('-o, --output-file <filename>', 'Output HTML filename', 'output.html')

program.parse(process.argv)
const options = program.opts()

const startHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"> <meta name="viewport" content="width=device-width, initial-scale=1"><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous"></head><body>`

const finishHtml = `<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/js/bootstrap.bundle.min.js" integrity="sha384-MrcW6ZMFYlzcLA8Nl+NtUVF0sA7MsXsP1UyJoMp4YLEuNSfAP+JcXn/tWtIaxVXM" crossorigin="anonymous"></script><script src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/js/bootstrap.min.js" integrity="sha384-cVKIPhGWiC2Al4u+LWgxfKTRIcfu0JTxR+EQDz/bgldoEyl4H0zUF0QKbrJ0EcQF" crossorigin="anonymous"></script></body></html>`

var wsFile = fs.createWriteStream(options.outputFile)

writeStream._write = (chunk, encoding, next) => {
  wsFile.write(chunk.toString())
  next()
}

async function fetchAndProcessData() {
  let data = false
  if (options.inputFile) {
    data = JSON.parse(fs.readFileSync(options.inputFile))
    debug(`parsing ${options.inputFile}`)
  } else {
    const url = `http://${options.host}:9292/query?jql=parentEpic=${options.parent}&fields=summary;issuelinks;progress;aggregateprogress;status;components;fixVersions;priority;parent;issuetype;assignee&changes=yes`
    debug(`parsing data fetched from url (${url})`)

    const { rawBody } = await got(url)

    data = JSON.parse(rawBody)
    debug(`Parsing ${data.issues.length} issues...`)
  }

  writeStream.write(startHtml)

  writeStream.write(`<table class='table table-sm'>
              <thead>
              <tr>
              <th>Key</th>
              <th>Summary</th>
              <th>Parent</th>
              <th>Status</th>
              <th>Issue Links</th>
              <th>Progress / Agg.</th>
              <th>Priority</th>
              <th>Fix Version</th>
              <th>Status Last Updated</th>
              </tr>
              </thead>
              <tbody>
              `)

  const now = new Date()

  data.issues.forEach((i) => {
    debug(`Processing: ${i.key}`)
    let lastStatusUpdated = getLastStatusChangeUpdateDate(i.changelog)
    let lastStatusUpdatedStr = lastStatusUpdated
      ? lastStatusUpdated.workingDaysFromNow(now)
      : ''

    debug(i.fields)

    let newRow = {
      key: i.key,
      summary: i.fields.summary,
      name: i.fields.issuetype ? i.fields.issuetype.name : '???',
      parent: {
        value: i.fields.parent ? i.fields.parent.key : '',
        icon: i.fields.parent ? i.fields.parent.fields.issuetype.iconUrl : '',
        statusUrl: i.fields.parent ? i.fields.parent.fields.status.iconUrl : '',
      },
      status: {
        value: i.fields.status.name,
        icon: i.fields.status.iconUrl,
      },
      issuelinks: i.fields.issuelinks.length
        ? i.fields.issuelinks.length
        : '',
      issuetype: {
        value: i.fields.issuetype.name,
        icon: i.fields.issuetype.iconUrl,
      },
      progress: i.fields.progress.percent ? i.fields.progress.percent : 0,
      aggregateprogress: i.fields.aggregateprogress.percent
        ? i.fields.aggregateprogress.percent
        : 0,
      priority: {
        value: i.fields.priority.name,
        icon: i.fields.priority.iconUrl,
      },
      fixVersions: i.fields.fixVersions.length
        ? i.fields.fixVersions.map((x) => x.name).join(',')
        : '',
      statusLastUpdatedDate: lastStatusUpdatedStr,
    }

    writeStream.write(
      simpleRow([
        `<a href='${config.jira.protocol}:${config.jira.host}/browse/${newRow.key}' target='_blank'>${newRow.key}</a>`,
        `<img src='${newRow.issuetype.icon}' title='${newRow.issuetype.value}'> ${newRow.summary}`,
        `<img src='${newRow.parent.icon}'>${newRow.parent.value}`,
        newRow.status.value,
        newRow.issuelinks,
        // `<img src='${newRow.issuetype.icon}' alt='${newRow.issuetype.value}'>`,
        `${newRow.progress} & ${newRow.aggregateprogress}`,
        `<img src='${newRow.priority.icon}' width='16px' alt='${newRow.priority.value}'>`,
        newRow.fixVersions,
        newRow.status.value == 'Done' ? '' : newRow.statusLastUpdatedDate,
      ])
    )
  })
  console.log(`Parsed data file containing ${data.issues.length} issues`)
  writeStream.write(`</tbody></table>`)
  writeStream.write(finishHtml)
}

debug(`fetchAndProcessData(data) about to be called...`)
fetchAndProcessData()

function simpleRow(arrContent) {
  return `<tr><td>${arrContent.join(`</td><td>`)}</td></tr>`
}

function getLastStatusChangeUpdateDate(changelog) {
  if (changelog && changelog.histories) {
    for (let i = 0; i < changelog.histories.length; i++) {
      const h = changelog.histories[i]
      // Items contains status?
      if (h.items.filter((x) => x.field == 'status').length > 0) {
        debug(`found status update: ${h.created}`)
        let result = new Date(h.created)
        debug(`...${result}: getMonth: ${result.getMonth()}`)
        return result
      } else {
        debug(
          `didn't find status update: ${h.created} (${h.items.length} items searched)`
        )
      }
    }
  } else {
    debug(`No history found...`)
  }
  return false
}
