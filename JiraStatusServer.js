'use strict'
const debug = require('debug')('JiraStatusServer')
const d = require('./dateExtension')
const restify = require('restify')
const restifyErrors = require('restify-errors')
const corsMiddleware = require('restify-cors-middleware')

const NodeCache = require('node-cache')
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 })

const config = require('config')

const mermaidConfig = require('./config/mermaid-config')
const MermaidNodes = require('./MermaidNodes')
const mermaid = new MermaidNodes()

const JiraStatus = require('./JiraStatus')

const JSR = require('./JiraStatusReporter')
let jsr = new JSR()

const JiraDataReader = require('./JiraDataReader')
let jdr = new JiraDataReader()

const Dashboard = require('./Dashboard')
const dashboard = new Dashboard()

const LocalStorage = require('node-localstorage').LocalStorage
let ls = new LocalStorage('./.cache')

// const path = require('path')
// const JiraDataCache = require('./JiraDataCache');

const labels = ['Epic', 'Story', 'Task', 'Sub-task', 'Bug', 'Requirement']
const states = ['Open', 'Active', 'Closed', 'Stopped', 'New']
const backgroundColors = [
  'SeaShell',
  'MediumSeaGreen',
  'CornflowerBlue',
  'Pink',
  'Purple'
]

const backgroundColorStr = "backgroundColor:['"
  .concat(backgroundColors.join("','"))
  .concat("']")

var server = restify.createServer()
server.use(restify.plugins.queryParser())

const cors = corsMiddleware({
  origins: ['*'],
  allowHeaders: [],
  exposeHeaders: []
})

server.use(cors.preflight)
server.use(cors.actual)

server.get(
  '/docs/*',
  restify.plugins.serveStatic({ directory: './static', default: 'charts.html' })
)

server.get('/', (req, res, next) => {
  res.send('ok')
  return next()
})

server.get('/count/', async (req, res, next) => {
  const count = await jsr.bareQueryCount(req.query.q)
  res.send({ count: count })
  res.end()
  return next()
})

server.get('/report/:project', (req, res, next) => {
  debug(`/report/${req.params.project} called`)
  JiraStatus.report(req.params.project)
    .then((response) => {
      // debug(`report response = `, response)
      res.send(response)
      res.end()
      return next()
    })
    .catch((err) => {
      throw err
    })
})

server.get('/homedir', (req, res, next) => {
  res.send(jsr.getFileManager().getHomeDir())
  return next()
})

server.get('/config', async (req, res, next) => {
  const configDetails = await JiraStatus.getConfig()
  if (req.query.format && req.query.format == 'html') {
    // TODO: Create automatic formatter
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.write(buildHtmlHeader('Config', false))
    res.write(buildPageHeader('Config'))
    res.write(JiraStatus.formatConfigHtml(configDetails))
    res.write(buildHtmlFooter())
  } else {
    res.send(configDetails)
    res.end()
  }
  return next()
})

server.get('/dates', (req, res, next) => {
  res.send(jdr.getDates())
  return next()
})

server.get('/series', (req, res, next) => {
  res.send(jdr.getSeriesData())
  return next()
})

function buildEpicPromisesArray(epicIds) {
  debug(`buildEpicPromisesArray(${epicIds}) called...`)
  let promises = []
  switch (typeof epicIds) {
    case typeof {}:
      epicIds.forEach((id, ndx) => {
        debug(`object - pushing ${id}...`)
        promises.push(jsr.getEpicAndChildren(id))
      })
      break
    case typeof []:
      epicIds.forEach((id, ndx) => {
        debug(`array - pushing ${id}...`)
        promises.push(jsr.getEpicAndChildren(id))
      })
      break
    case typeof '':
      debug(`string - splitting...`)
      let epicList = []
      if (epicIds.indexOf(',') > 0) {
        epicList = epicIds.split(',')
        epicList.push()
      } else {
        epicList.push(epicIds)
      }
      debug(`... ${epicList}...`)
      epicList.forEach((id, ndx) => {
        debug(`string - ...pushing ${id}...`)
        promises.push(jsr.getEpicAndChildren(id))
      })
      break
    default:
      debug(`unknown typeof epicIds: ${typeof epicIds}`)
  }
  debug(`... about to return ${promises}`)
  return promises
}

function buildLegend() {
  let legendStr = "<div class='sticky legend'>"
  backgroundColors.forEach((c, ndx) => {
    legendStr += `<span style="background-color: ${c}; padding: 4px; border: 6px; border-color: ${c}; margin: 5px; border-style: solid; border-radius: 8px; z-index: 999;">${states[ndx]}</span>`
  })
  legendStr += '</div>'
  return legendStr
}

function buildHtmlHeader(title = '', showButtons = true) {
  // Bootstrap 5 alpha
  // return(`<!doctype html><html lang="en"><head><title>${title}</title><meta charset="utf-8"><link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/5.0.0-alpha1/css/bootstrap.min.css" integrity="sha384-r4NyP46KrjDleawBgD5tp8Y7UzmLA05oM1iAEQ17CSuDqnUK2+k9luXQOfXJCJ4I" crossorigin="anonymous">${buildStylesheet()}</head>`)

  let buttons = [`<button id='toggleCharts' type='button' class='btn btn-outline-primary btn-sm float-right'>Toggle Charts</button>`, `<button id='toggleButton' type='button' class='btn btn-outline-primary btn-sm float-right'>Toggle Names</button>`, `<button id='toggleLegend' type='button' class='btn btn-outline-primary btn-sm float-right'>Toggle Legend</button>`]

  if (typeof showButtons === 'boolean') {
    if (!showButtons) {
      buttons = []
      debug('emptying showButtons')
    }
  } else if (typeof showButtons === 'number') { // Single button to show
    debug(`showButtons[${showButtons}] set`)
    buttons = [buttons[showButtons]]
  } else if (typeof showButtons === 'object') { // Array of buttons to show
    console.error('typeof showButtons === object/array is not yet implemented')
  }

  // Bootstrap 4.5
  return `<!doctype html><html lang="en"><head><title>${title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
        ${JiraStatus.getFontawesomeJsLink()}

        <!-- Bootstrap CSS -->
        <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" integrity="sha384-JcKb8q3iqJ61gNV9KGb8thSsNjpSL0n8PARn9HuZOnIxN0hoP+VmmDGMN5t9UJ0Z" crossorigin="anonymous">
        <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js" integrity="sha384-DfXdz2htPH0lsSSs5nCTpuj/zy4C+OGpamoFVy38MVBnE+IbbVYUew+OrCXaRkfj" crossorigin="anonymous"></script>
        ${buildStylesheet()}
        ${buildButtonJs()}
        
        <script src="https://cdnjs.cloudflare.com/ajax/libs/billboard.js/2.0.3/billboard.pkgd.min.js"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/billboard.js/2.0.3/theme/graph.min.css"></link>
        </head>
        <body>
        <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
        <script>mermaid.initialize({startOnLoad:true});</script>
        ${buttons.join('')}
        `
}

function buildPageHeader(h, h2 = '') {
  return `<h1>${h}</h1><h2>${h2}</h2>`
}

function buildStylesheet() {
  return `<style>
    .children { padding-left: 20px; }
    .icon { padding: 4px; }
    .Icebox, .New, .Open { background-color: white; }
    .InProgress { background-color: green; }
    .InReview { background-color: lightgreen; color: black; }
    .Done, .CLOSED { background-color: blue; color: white; }
    .Dead { background-color: black; }
    .Emergency { background-color: pink; color: black; }
    .Blocked { background-color: pink; color: black; }
    .Rejected { background-color: darkred; fill: darkred; color: white; }
    .New { background-color: #00bbbb; fill: #00bbbb; color: white; }
    .Committed { background-color: navy; fill: navy; color: white; }
    .Completed { background-color: darkgreen; fill: darkgreen; color: white; }
    
    .labels { font-size: smaller; font-style: italic; color: darkgray; }
    
    .legend { position: sticky; right: 0; bottom: 0; z-index: -1; }
    .link { text-decoration: none; }
    .issueComboLink { display: grid; }
    .issueName { display: inline; }
    .miniJSRChart { display: table-cell; }
    .miniJSRChartTable { display: table; }
    .hidden { display: none; }
    .bb-title { font-size: 17px !important; font-weight: bold; }
    .wraparound { display: contents; }
    .bundledicon { margin: -2px 4px -2px 4px; }
    .lineicon { margin: -2px 4px 0px 0px; }

    .summaryCol { width: 30%; }
    .linksCol { width: 150px; }
    .fixVersionCol { width: 150px; }
    .nameCol { width: 150px; }
    .statusCol { }
    .childrenCol { width: 30%; }

    .summCell { text-align: center; }
    .smcenter { font-size: smaller; text-align: center; }
    .smright { font-size: smaller; text-align: right; }

    .problem { background-color: pink; color: black; }

    .tooltip-inner { max-width: 500px; text-align: left; }
    </style>`
}

function buildButtonJs() {
  return `<script>
    let showNames = true;
    let showCharts = true;
    let showLegend = true;
    const tog = function() { console.log('in tog') }
    $(document).ready(function(){
        $('#toggleButton').click(function(){
              $('.issueName').toggleClass('hidden');
              $('.issueComboLink').toggleClass('wraparound')
              $('.issueComboLink').toggleClass('bundledicon')
              $('.issueComboLink').toggleClass('lineicon')
        });
        $('#toggleCharts').click(function(){
            $('.pieCharts').toggleClass('hidden')
        });
        $('#toggleLegend').click(function(){
            $('.legend').toggleClass('hidden')
        })
    });
    </script>`
}

function buildHtmlFooter() {
  // Bootstrap 5 alpha
  // return(`<script src="https://cdn.jsdelivr.net/npm/popper.js@1.16.0/dist/umd/popper.min.js" integrity="sha384-Q6E9RHvbIyZFJoft+2mJbHaEWldlvI9IOYy5n3zV9zzTtmI3UksdQRVvoxMfooAo" crossorigin="anonymous"></script>

  // Bootstrap 4.5
  return `<script src="https://cdn.jsdelivr.net/npm/popper.js@1.16.1/dist/umd/popper.min.js" integrity="sha384-9/reFTGAW83EW2RDu2S0VKaIzap3H66lZH81PoYlFhbGU+6BZp6G7niu735Sk7lN" crossorigin="anonymous"></script>
    <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js" integrity="sha384-B4gt1jrGC7Jh4AgTPSdUtOBvfO8shuf57BaghqFfPlYxofvL8/KUEfYiJOMMV+rV" crossorigin="anonymous"></script>
    <script>
    $(function () {
      $('[data-toggle="tooltip"]').tooltip()
    })
    </script>`
}

/**
 *Create HTML for pie charts
 *
 * @param {*} stats
 */
async function buildPieCharts(stats) {
  const w = 120
  const h = w

  debug(`buildPieCharts() called`)
  debug(stats)
  let results = []

  results.push("<span id='pieCharts' class='pieCharts miniJSRChartTable'>")

  let jsrCLM = jsr.getChartLinkMaker(config).reset()
  jsrCLM.setCategories(['a', 'b']).reset().setSize(250)

  let promiseList = []
  // Charts...
  labels.forEach((i, ndx) => {
    if (i !== 'Requirement') {
      debug(`stats[${i}] = `, stats[i])
      promiseList.push(jsrCLM.buildChartImgTag(i, stats[i]))
    }
  })

  const charts = await Promise.all(promiseList)
  results.push(charts)
  results.push('</span>')
  debug('returning from buildPieCharts(stats)...')
  return results.join('')
}

// Clean out " from string - for use with Title attribute values
function cleanText(t) {
  let newText = t
  newText = newText.replace(/'/g, '&apos;')
  newText = newText.replace(/"/g, '&quot;')
  newText = newText.replace(/>/g, '&#062;')
  newText = newText.replace(/</g, '&#060;')
  return newText
}

function updateStats(stats, issueType, issueStatusName) {
  let newStats = stats
  debug(`updateStats(stats, ${issueType}, ${issueStatusName}) called...`)
  switch (issueStatusName) {
    case 'Icebox':
    case 'Defined':
    case 'New':
    case 'Open':
      newStats[issueType]['Open'] += 1
      break
    case 'In Progress':
    case 'In Review':
      debug(`In Progress or In Review.`)
      newStats[issueType]['Active'] += 1
      break
    case 'Done':
    case 'CLOSED':
    case 'Dead':
      newStats[issueType]['Closed'] += 1
      break
    case 'Emergency':
    case 'Blocked':
      newStats[issueType]['Stopped'] += 1
      break
  }
  return newStats
}

/*
 ************** ENDPOINTS **************
 */

/*
 * Function Template *
server.get('/endpoint', async (req, res, next) => {
  const pageTitle = 'Requirements Report'
  res.write(buildHtmlHeader(pageTitle, false))
  res.write(buildPageHeader(pageTitle))
  try {
  } catch (err) {
    debug(err)
    res.write(`<em>error</em><!-- ${err} -->`)
  }
  res.write(buildHtmlFooter())
  res.end()
  return next()
})

*/

server.get('/cache/stats', async (req, res, next) => {
  try {
    res.send({ stats: cache.getStats(), keys: cache.keys() })
  } catch (err) {
    debug(err)
    res.send({ error: err.message })
  }
  return next()
})

server.get('/cache/flush', async (req, res, next) => {
  try {
    cache.flushAll()
    res.send({ result: 'flushed', stats: cache.getStats(), keys: cache.keys() })
  } catch (err) {
    debug(err)
    res.send({ error: err.message })
  }
  return next()
})

async function getEpicEstimates(epicKey) {
  if (!cache.has(`epicEstimate-${epicKey}`)) {
    const fields = ['summary', 'assignee', 'customfield_10008', 'aggregateprogress', 'progress', 'timetracking']
    // Query for stories by parent epic
    const result = await jsr._genericJiraSearch(`'Epic Link' in (${epicKey}) AND status not in (Done,Dead) and issuetype=story`, 99, fields)
    const storyData = []
    let progress = 0
    let total = 0
    result.issues.forEach((issue) => {
      progress += issue.fields.aggregateprogress.progress
      total += issue.fields.aggregateprogress.total
      storyData.push({
        key: `${issue.key} ${issue.fields.summary}`,
        assignee: issue.fields.assignee ? issue.fields.assignee.displayName : '',
        progress: issue.fields.aggregateprogress.progress,
        total: issue.fields.aggregateprogress.total
      })
      cache.set(`epicEstimate-${epicKey}`, { progress: progress, total: total, details: storyData })
    })
  }
  return (cache.get(`epicEstimate-${epicKey}`))
}

async function getVersions(flushCache) {
  if (!cache.has('versions') || (flushCache && flushCache == 'yes')) {
    debug(`getVersions(${flushCache})... updating cache...`)
    cache.set('versions', await jsr.get(`/project/${config.project}/versions`))
  }
  return(cache.get('versions'))
}

function compileVersionDetails(issues, versionId, storyOnly = false) {
  const versionDetails = { components: [], issues: issues, componentEstimates: {} }
  const components = [['none']]
  let componentEstimates = { ['none']: { progress: 0, total: 0, percent: 0, timeoriginalestimate: 0 } }
  if (!cache.has(`versionDetails-${versionId}`)) {
    issues.forEach((issue) => {
      // Store components
      if (issue.fields.components) {
        let issueComponents = issue.fields.components.map(x => x.name)
        issueComponents.forEach((c) => {
          if (!components.includes(c)) { 
            components.push(c)
            componentEstimates[c] = { count: { Epic: 0, Story: 0, 'Sub-task': 0, 'Bug': 0, 'Task': 0, 'Requirement': 0 }, progress: 0, total: 0, percent: 0, timeoriginalestimate: 0, assignees: {}, issues: [] }
          }
          // Update component estimates
          componentEstimates[c].progress += issue.fields.progress.progress
          componentEstimates[c].total += issue.fields.progress.total
          componentEstimates[c].timeoriginalestimate += issue.fields.timeoriginalestimate
          componentEstimates[c].count[issue.fields.issuetype.name]++
          let assignee = issue.fields.assignee ? issue.fields.assignee.displayName : 'none'
          if (!Object.keys(componentEstimates[c].assignees).includes(assignee)) {
            componentEstimates[c].assignees[assignee] = {
              Epic: { progress: 0, total: 0 },
              Story: { progress: 0, total: 0 },
              'Sub-task': { progress: 0, total: 0 },
              Bug: { progress: 0, total: 0 },
              Task: { progress: 0, total: 0 },
              Requirement: { progress: 0, total: 0 }
            }
          }
          
          // debug(c, assignee, issue.fields.issuetype.name, issue.fields.progress.progress)

          componentEstimates[c].assignees[assignee][issue.fields.issuetype.name].progress += issue.fields.progress.progress
          componentEstimates[c].assignees[assignee][issue.fields.issuetype.name].total += issue.fields.progress.total

          //   debug(issue.key, issue.fields.progress, issue.fields.aggregateprogress, issue.fields.timeoriginalestimate, issue.fields)
        })
      } else {            // No component set, so record this to 'none'
        componentEstimates['none'].progress += issue.fields.progress.progress
        componentEstimates['none'].total += issue.fields.progress.total
        componentEstimates['none'].timeoriginalestimate += issue.fields.timeoriginalestimate
      }
    })
    // debug(`componentEstimates: `, componentEstimates)

    versionDetails.componentEstimates = componentEstimates
    versionDetails.components = components
    debug(`...creating new cache value for versionDetails-${versionId}`)
    cache.set(`versionDetails-${versionId}`, versionDetails)
    return versionDetails
  } else {
    debug(`...returning versionDetails-${versionId} cached value`)
    return(cache.get(`versionDetails-${versionId}`))
  }
}

server.get('/progress/:rel', async (req, res, next) => {
  const rel = req.params.rel || false
  const storyOnly = req.params.storyOnly || false

  if (rel) {
    const pageTitle = 'Progress Report'
    res.write(buildHtmlHeader(pageTitle, false))
    res.write(buildPageHeader(pageTitle))
    try {
      const versions = await getVersions(false)
      const version = versions.filter((v) => v.id == rel)[0]
      // debug(version)
      res.write(`<h2>${version.name}</h2>`)
      res.write(`<h3>Release Date: ${version.releaseDate}</h2>`)

      const versionRelatedIssues = await jsr.get(`/version/${rel}/relatedIssueCounts`)
      const versionUnresolvedIssues = await jsr.get(`/version/${rel}/unresolvedIssueCount`)
      let versionIssues
      if (!cache.has(`versionIssues-${rel}`)) {
        const jql = `project=${config.project} AND fixVersion=${rel}`
        debug(`jql: ${jql}`)
        versionIssues = await jsr._genericJiraSearch(jql, 99, ['summary', 'issuetype', 'assignee', 'components', 'aggregateprogress', 'progress', 'timeoriginalestimate'])
        cache.set(`versionIssues-${rel}`, versionIssues)
      } else {
        versionIssues = cache.get(`versionIssues-${rel}`)
      }
      // debug(`issues[0]: `, versionIssues.issues[0], versionIssues.issues[0].fields.components)
      res.write(`<ul>
        <li>Fixed Issues: ${versionRelatedIssues.issuesFixedCount}</li>
        <li>Affected Issues: ${versionRelatedIssues.issuesAffectedCount}</li>
        <li>Unresolved Issues: ${versionUnresolvedIssues.issuesUnresolvedCount}</li>
        </ul>`)
      let versionDetails = compileVersionDetails(versionIssues.issues, rel, storyOnly)
      const COLUMNS = ['Component', 'Completed', 'Remaining', 'Percent', 'Original Est.']
      res.write(`<table style='width: auto !important;' class='table table-sm'><thead><tr><th>${COLUMNS.join('</th><th>')}</th></tr></thead><tbody>`)
      Object.keys(versionDetails.componentEstimates).sort().forEach((component) => {
        res.write(`<tr class='table-active'><td>${component}</td>
        <td class='summCell'>${cleanSeconds(versionDetails.componentEstimates[component].progress)}</td>
        <td class='summCell'>${cleanSeconds(versionDetails.componentEstimates[component].total)}</td>
        <td class='summCell'>${cleanSeconds(versionDetails.componentEstimates[component].percent)}</td>
        <td class='summCell'>${cleanSeconds(versionDetails.componentEstimates[component].timeoriginalestimate)}</td>
        </tr>`)
        // Now print the assignee details/progress
        if (versionDetails.componentEstimates[component].assignees) {
          // debug(`assignees: `, versionDetails.componentEstimates[component].assignees)
          Object.keys(versionDetails.componentEstimates[component].assignees).sort().forEach((assignee) => {
            // Print total for this user
            res.write(`<tr>
              <td class='smright'><a href='${config.jira.protocol}://${config.jira.host}/issues/?jql=assignee="${assignee}"%20AND%20component="${component}"%20AND%20fixversion=${rel}' target='_blank'>${assignee}</a></td>
            `)
            let resp = '' // HTML response for rest of user's data
            let prog = 0  // Temp holder for progress
            let tot = 0   // Temp holder for total

            Object.keys(versionDetails.componentEstimates[component].assignees[assignee]).forEach((type) => {
              // debug(`type: ${type}; Value: `, versionDetails.componentEstimates[component].assignees[assignee][type])
              prog += versionDetails.componentEstimates[component].assignees[assignee][type].progress
              tot += versionDetails.componentEstimates[component].assignees[assignee][type].total
            })
            // Print each issue type
            res.write(`
              <td class='smcenter'>${cleanSeconds(prog)}</td>
              <td class='smcenter'>${cleanSeconds(tot)}</td>
              <td></td>
              <td></td>`)
            res.write(`</tr>`)
          })
        }
      })
      res.write('</tbody></table>')
      
    } catch (err) {
      debug(err)
      res.write(`<em>error</em><!-- ${err} -->`)
    }
    res.write(buildHtmlFooter())
    res.end()
  } else {
    res.send({ err: 'invalid release' })
  }
  return next()
})

server.get('/releases', async (req, res, next) => {
  try {
    const releases = await getVersions(false)
    if (req.query.format && req.query.format == 'html') {
      const pageTitle = 'Releases Report'
      res.write(buildHtmlHeader(pageTitle, false))
      res.write(buildPageHeader(pageTitle))
      const COLUMNS = ['Name', 'Description', 'Archived', 'Released', 'Release Date', 'User Release Date']
      res.write(`<table style='width: auto !important;' class='table table-sm table-striped'><thead><tr><th>${COLUMNS.join('</th><th>')}</th></tr></thead><tbody>`)
      releases.forEach((rel) => {
        res.write(`<tr>
          <td>${rel.name}</td>
          <td>${rel.description || ''}</td>
          <td>${rel.archived}</td>
          <td>${rel.released}</td>
          <td>${rel.releaseDate}</td>
          <td>${rel.userReleaseDate}</td>
          <td><a href='progress/${rel.id}' target='_blank'>Progress Report</a></td>
          </tr>
        `)

      })
      res.write(`</tbody></table>`)
      res.write(buildHtmlFooter())
      res.end()
    } else {
      res.send(releases)
    }
  } catch (err) {
    debug(err)
    res.write(`<em>error</em><!-- ${err} -->`)
    res.end()
  }
  return next()
})

server.get('/estimates', async (req, res, next) => {
  const today = new Date()

  let relFilter = ''
  if (req.query.release) {
    relFilter = ` and fixVersion = "${req.query.release}"`
    debug(`JQL: ${relFilter}`)
  }

  const releases = {}

  if (req.query.flush && req.query.flush === 'yes') {
    cache.flushAll()
  }

  let format = req.query.format ? req.query.format : 'html'
  let sort = req.query.sort ? `${req.query.sort}, ` : ''

  const pageTitle = 'Estimates Report'
  const COLUMNS = ['Epic', 'Story', 'Release', 'Assignee', 'Spent', 'Total', '% Done']
  const FIELDS = ['summary', 'assignee', 'customfield_10008', 'aggregateprogress', 'progress', 'timetracking', 'labels', 'fixVersions']

  try {
    // Get data
    const epics = {}
    if (!cache.has('epicList')) {
      debug('...epicList: loading from Jira')
      cache.set('epicList', await jsr._genericJiraSearch(`issuetype=epic and project=${config.project} ${relFilter}`, 99, ['summary', 'assignee']))
    } else {
      debug('...epicList: loading from cache')
    }
    cache.get('epicList').issues.forEach((epic) => {
      epics[epic.key] = epic.fields.summary
    })

    if (!cache.has('storyList')) {
      debug('...storyList: loading from Jira')
      cache.set('storyList', await jsr._genericJiraSearch(`issuetype=story and status not in (dead, done) and project=${config.project} and "Epic Link" is not empty ${relFilter} order by ${sort}"EPIC LINK" ASC, key ASC`, 99, FIELDS))
    } else {
      debug('...storyList: loading from cache')
    }
    const storyList = cache.get('storyList')

    if (format == 'csv') {
      COLUMNS.pop()
      let response = COLUMNS.join("\t") + "\n"
      storyList.issues.forEach((story) => {
        response += ([story.fields.customfield_10008 + ' ' + epics[story.fields.customfield_10008],
        story.key + ' ' + story.fields.summary,
        story.fields.assignee ? story.fields.assignee.displayName : 'none',
        story.fields.aggregateprogress.progress,
        story.fields.aggregateprogress.total
        ].join("\t"))
        response += "\n"
      })
      res.header('Content-Type', 'text/csv')
      res.header('Content-Disposition', 'attachment;filename=export.csv')
      res.send(response)
      return next()
    } else {
      // Assignee stats:
      let assigneeStats = { 'none': { progress: 0, total: 0, count: [], empty: [], rel: {} } }

      res.write(buildHtmlHeader(pageTitle, false))
      res.write(buildPageHeader(pageTitle))

      res.write(`<div><a href='?format=csv'>Download as csv</a></div>`)
      // Write table
      res.write(`<table style='width: auto !important;' class='table table-sm table-striped'><thead><tr><th>${COLUMNS.join('</th><th>')}</th></tr></thead><tbody>`)
      storyList.issues.forEach((story) => {
        // debug(`story & labels & fixVersions: `, story.key, story.fields.labels.join(', '), story.fields.fixVersions)
        res.write(`<tr>
                  <td class='epicCol' style='font-size: smaller; color: gray;'>${story.fields.customfield_10008} ${epics[story.fields.customfield_10008]}</td>
                  <td>${story.key} ${story.fields.summary}</td>`)

        // Release(s)
        const fixVersions = story.fields.fixVersions.map((x) => { return (x.name) }).join(', ') || 'unset'
        if (story.fields.fixVersions.length > 1) { debug(`Multiple fixVersions for ${story.key}: ${fixVersions}`) }
        res.write(`<td class='fixVersionCol'>${fixVersions}</td>`)

        // Store the release value in the releases list
        if (!(Object.keys(releases).includes(fixVersions))) {
          releases[fixVersions] = { total: story.fields.aggregateprogress.total, progress: story.fields.aggregateprogress.progress }
        } else {
          releases[fixVersions]['total'] = releases[fixVersions]['total'] + story.fields.aggregateprogress.total
          releases[fixVersions]['progress'] = releases[fixVersions]['progress'] + story.fields.aggregateprogress.progress
        }

        // There is an assignee
        if (story.fields.assignee) {
          const assignee = story.fields.assignee.displayName
          res.write(`<td class='storyCol'>${assignee}</td>`)

          // Update assigneeStats
          if (!(assignee in assigneeStats)) { assigneeStats[assignee] = { progress: 0, total: 0, count: [], empty: [], rel: {} } }
          assigneeStats[assignee].count.push(`${story.key} ${story.fields.summary} [${cleanSeconds(story.fields.aggregateprogress.progress)} of ${cleanSeconds(story.fields.aggregateprogress.total)}d]`)

          assigneeStats[assignee].progress += story.fields.aggregateprogress.progress
          assigneeStats[assignee].total += story.fields.aggregateprogress.total

          if (!Object.keys(assigneeStats[assignee]['rel']).includes(fixVersions)) {
            assigneeStats[assignee]['rel'][fixVersions] = { total: cleanSeconds(story.fields.aggregateprogress.total), progress: cleanSeconds(story.fields.aggregateprogress.progress) }
          } else { // Key already exists, so increment it
            assigneeStats[assignee]['rel'][fixVersions].total = assigneeStats[assignee]['rel'][fixVersions].total + cleanSeconds(story.fields.aggregateprogress.total)
            assigneeStats[assignee]['rel'][fixVersions].progress = assigneeStats[assignee]['rel'][fixVersions].progress + cleanSeconds(story.fields.aggregateprogress.progress)
          }

          if (story.fields.aggregateprogress.total == 0) { assigneeStats[assignee].empty.push(`${story.key} ${story.fields.summary}`) }
        } else { // No assignee
          res.write(`<td class='storyCol problem'>none</td>`)
          assigneeStats.none.count.push(`${story.key} ${story.fields.summary}`)
          assigneeStats.none.progress += story.fields.aggregateprogress.progress
          assigneeStats.none.total += story.fields.aggregateprogress.total
          if (assigneeStats.none.total == 0) { assigneeStats.none.empty.push(`${story.key} ${story.fields.summary}`) }
        }

        // Spent
        res.write(`<td class='spentCol'>${cleanSeconds(story.fields.aggregateprogress.progress)} d</td>`)
        // Total
        if (story.fields.aggregateprogress.total > 0) {
          res.write(`<td class='totalCol'>${cleanSeconds(story.fields.aggregateprogress.total)} d</td>`)
        } else {
          res.write(`<td class='totalCol problem'>0d</td>`)
        }

        // Percent Done
        res.write(`<td class='percentDoneCol'>${story.fields.aggregateprogress.total > 0 ? (100 * (story.fields.aggregateprogress.progress / story.fields.aggregateprogress.total).toFixed(2)) : '0'}%</td>
                  </tr>`)
      })
      res.write(`</tbody></table>`)
      res.write(`<hr>`)
      // Write Releases table
      res.write(`<h2>Releases</h2>`)
      debug(releases)
      res.write(`<table style='width: auto !important;' class='table table-sm table-striped'><thead>
        <tr>
          <th>Release</th>
          <th>Spent (days)</th>
          <th>Planned (days)</th>
        </tr></thead><tbody>`)
      Object.keys(releases).sort().forEach((rel) => {
        res.write(`
          <td>${rel}</td>
          <td>${cleanSeconds(releases[rel].progress)}</td>
          <td>${cleanSeconds(releases[rel].total)}</td>
          </tr>`)
      })
      res.write('</tbody></table>')

      res.write(`<hr>`)

      let USER_COLUMNS = ['Name', 'Spent', 'Total', 'Completed', 'Missing Est. (%)']
      // Write User Data table
      res.write(`<h2>User Report</h2>`)
      res.write(`<table style='width: auto !important;' class='table table-sm table-striped'><thead>
        <tr><th>${USER_COLUMNS.join('</th><th>')}</th>`)
      Object.keys(releases).sort().forEach((rel) => { res.write(`<th>${rel}</th>`) })
      res.write(`</tr></thead><tbody>`)
      // debug(assigneeStats)
      Object.keys(assigneeStats).forEach((a) => {
        const titleContentCount = assigneeStats[a].count.length > 0 ? '<b>Total Story List</b><ol><li>' + assigneeStats[a].count.join('</li><li>') + '</ol>' : 'none'
        const titleContentEmpty = assigneeStats[a].empty.length > 0 ? `<b>Unestimated Story list</b><ol><li>${assigneeStats[a].empty.join('</li><li>')}</ol>` : 'none'

        res.write(`<tr>
          <td class='nameCol'>${a}</td>
          <td class='spentCol'>${assigneeStats[a].progress > 0 ? cleanSeconds(assigneeStats[a].progress) : 0} d</td>
          <td class='totalCol`)
        if (assigneeStats[a].total == 0) {
          res.write(` problem'>0d</td>`)
        } else {
          const days = cleanSeconds(assigneeStats[a].total)
          const endDate = calcFutureDate(cleanSeconds(assigneeStats[a].total - assigneeStats[a].progress))
          res.write(`'><span title='${endDate}'>${days} d</td>`)
        }
        // Completed
        res.write(`<td class='completedCol'>${assigneeStats[a].total > 0 ? Math.round(100 * (assigneeStats[a].progress / assigneeStats[a].total)) : 0}%</td>`)
        // Missing Estimate
        res.write(`<td class='missingEstCol'><span data-toggle="tooltip" data-html="true" title="${titleContentEmpty}">${assigneeStats[a].empty.length}</span> of <span data-toggle="tooltip" data-html="true" title="${titleContentCount}">${assigneeStats[a].count.length}</span> 
          (${assigneeStats[a].empty.length > 0 ? (100 * (assigneeStats[a].empty.length / assigneeStats[a].count.length)).toFixed(0) : 0}%)</td>`)

        // Releases details
        Object.keys(releases).sort().forEach((rel) => {
          debug(`processing release data for user = ${a} rel = ${rel}`)
          // Print the user's numbers for this release
          if (Object.keys(assigneeStats[a]['rel']).includes(rel)) {
            // debug(`assigneeStats[a]['rel'][${rel}] = `, assigneeStats[a]['rel'][rel])
            const userProgress = assigneeStats[a]['rel'][rel].progress
            const userTotal = assigneeStats[a]['rel'][rel].total
            res.write(`<!-- ${rel} --><td>${userProgress} of ${userTotal}</td>`)
          } else {
            res.write('<!-- no data --><td></td>')
          }
        })
        res.write(`</tr>`)
        // Sum of estimates by release
      })
      res.write(`<tr><td><em>Release Totals</em></td><td colspan=${USER_COLUMNS.length - 1}></td>`)
      Object.keys(releases).sort().forEach((rel) => {
        res.write(`<td><b>${cleanSeconds(releases[rel].progress)} of ${cleanSeconds(releases[rel].total)}d</b></td>`)
      })
      res.write('</tr>')

      res.write(buildHtmlFooter())
    }
    res.end()
    return next()
  } catch (err) {
    debug(err)
    res.write(`<em>error</em><!-- ${err} -->`)
    res.end()
    return next()
  }
})

// Convert seconds into days
function cleanSeconds(sec) {
  let result = (sec / 28800).toFixed(2)
  if (result == Math.round(result)) { result = Math.round(result) }
  return (result)
}

// Ignore weekends
function calcFutureDate(dplus) {
  debug(`calcFutureDate(${dplus}) called...`)
  const d = new Date()
  const dFuture = d.addBusinessDays(dplus, true)
  return (`${dFuture.getMonth() + 1}/${dFuture.getDate()}/${dFuture.getFullYear()}`)
}

async function getRequirements() {
  debug('getRequirements() called')
  if (!cache.has('requirements')) {
    debug('...fetching from Jira')
    cache.set('requirements', await jsr._genericJiraSearch(`issuetype=requirement and project=${config.project} order by key`, 99), 3600)
  } else {
    debug('...fetching from cache')
  }
  return cache.get('requirements')
}

async function getGroups(flushCache) {
  if (!cache.has('groups') || (flushCache && flushCache == 'yes')) {
    cache.set('groups', await jsr.get('/groups/picker?maxResults=50'))
  }
  return(cache.get('groups'))
}

async function getSmallGroups(flushCache = false) {
  if (!cache.has('smallGroups') || (flushCache && flushCache == 'yes')) {
    const groups = await getGroups(false)
    debug('getSmallGroups.length == ', groups.groups.length)
    const smallGroups = groups.groups.filter(g => config.userGroups.includes(g.name))
    for (let gi = 0; gi < smallGroups.length; gi++) {
      const gname = smallGroups[gi].name
      smallGroups[gi].members = await getGroupMembers(gname)
    }
    cache.set('smallGroups', smallGroups)
  }
  return cache.get('smallGroups')
}

async function getGroupMembers(groupName) {
  debug(`getGroupMembers(${groupName}) called...`)
  let groupMembers = []
  if (!cache.has(`groupMembers-${groupName}`)) {
    const mbrs = await jsr.get(`/group/member?groupname=${groupName}`)
    if (config.has('userExclude')) {
      // Exclude specific users
      groupMembers = mbrs.values.map((v) => { return v.displayName }).filter(x => !config.userExclude.includes(x))
    } else {
      groupMembers = mbrs.values.map((v) => { return v.displayName })
    }
    cache.set(`groupMembers-${groupName}`, groupMembers)
  }
  return(cache.get(`groupMembers-${groupName}`))
}

async function getChildren(parentId) {
  debug(`getChildren(${parentId}) called`)
  try {
    if (!cache.has(`children-${parentId}`)) {
      debug('...fetching from Jira')
      cache.set(`children-${parentId}`, await jsr._genericJiraSearch(`parentEpic=${parentId} and key != ${parentId} ORDER BY key asc`, 99, ['summary', 'status', 'assignee', 'labels', 'fixVersions', 'issuetype', 'issuelinks']))
    } else {
      debug('...fetching from cache')
    }
    return (cache.get(`children-${parentId}`))
  } catch (err) {
    debug(`getChildren(${parentId}) error: `, err)
    return (null)
  }
}

server.get('/children/:id', async (req, res, next) => {
  try {
    debug(req.params.id, req.params.id.length)
    if (req.params.id && req.params.id.length > 4) {
      const kids = await getChildren(req.params.id)
      res.send(kids)
    } else {
      debug('id.len not > 4')
      res.send(`Error: Invalid Jira issue id`)
    }
    return next()
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`)
    debug(err)
    return next()
  }
})

server.get('/groups', async (req, res, next) => {
  try {
    if (req.query.flush && req.query.flush == 'yes') {
      cache.flushAll()
    }

    const groups = await getGroups()
    if (req.query.format && req.query.format == 'html') {
      const pageTitle = 'Groups'
      res.write(buildHtmlHeader(pageTitle, false))
      res.write(buildPageHeader(pageTitle))

      // Build the table
      if (req.query.filter && req.query.filter == 'yes') {
        debug('returning filtered list')
        const smallGroups = await getSmallGroups()
        // debug(`smallGroups: `, smallGroups)
        
        res.write(`Showing ${smallGroups.length} groups`)
        res.write('<ol>')

        for (let gi = 0; gi < smallGroups.length; gi++) {
          res.write(`<li><em>${smallGroups[gi].name}</em>: `)
          // debug(`smallGroups[${gi}] `, smallGroups[gi])
          res.write(smallGroups[gi].members.join(', '))
        }

        res.write('</li></ul>')
      } else {
        res.write(groups.header)
        debug('returning un-filtered list')
        res.write(['<ol><li>', groups.groups.map((g) => { return g.name }).join('</li><li>'), '</li></ul>'].join(''))
      }
      res.write(buildHtmlFooter())
      res.end()
      return next()
    } else {
      res.send(cache.get('groups'))
    }
    return next()
  } catch (err) {
    debug('unknown error #783: ', err)
    return next(new restifyErrors.InternalServerError('unknown error #783'))
  }
})

server.get('/requirements', async (req, res, next) => {
  const pageTitle = 'Requirements Report'
  res.write(buildHtmlHeader(pageTitle, 1))
  res.write(buildPageHeader(pageTitle))
  try {
    let inwardLinks = []
    let teamCount = 0
    let implementedByCounter = 0
    const childrenCache = []

    const COLUMNS = {
      'Name': '',
      'Summary': '',
      'fixVersion': '',
      'Teams': '',
      'Status': '',
      'Links': '',
      'Children': ''
    }

    const reqts = await getRequirements()
    debug(`startAt: ${reqts.startAt}; maxResults: ${reqts.maxResults}; total: ${reqts.total}`)
    res.write(`<em>${reqts.issues.length} requirements</em>`)

    // Build the table
    res.write(`<table class='table table-sm'><thead><tr>`)
    Object.keys(COLUMNS).forEach((col) => {
      res.write(`<th ${COLUMNS[col]}>${col}`)
    })
    res.write(`</tr></thead><tbody>`)

    for (let r = 0; r < reqts.issues.length; r++) {
      const reqt = reqts.issues[r]
      teamCount = 0
      res.write(`<tr>`)
      res.write(`<td class='nameCol'><a href='${config.get('jira.protocol')}://${config.get('jira.host')}/browse/${reqt.key}' target='_blank'>${reqt.key}</td>`)
      res.write(`<td class='summaryCol'>${reqt.fields.summary}`)
      if (reqt.fields.labels.length) {
        res.write(` <span class='labelsCol'>[${reqt.fields.labels.join(', ')}]</span>`)
        // debug(reqt.fields.labels)
      }
      res.write(`</td>`)

      res.write(`<td class='fixVersionsCol'>${reqt.fields.fixVersions.map(x => x.name).join(', ')}</td>`)

      // Teams
      if (reqt.fields.customfield_10070) {
        res.write(`<td class='teamsCol'>${reqt.fields.customfield_10070.map(x => x.value).join(', ')}</td>`)
        teamCount = reqt.fields.customfield_10070.length
      } else {
        res.write(`<td class='teamsCol'>None</td>`)
        teamCount = 0
      }

      res.write(`<td class='statusCol ${JiraStatus.formatCssClassName(reqt.fields.status.name)}'>${reqt.fields.status.name}</td>`)

      const implementedByKeys = []

      res.write(`<td class='linksCol'>`)
      if (reqt.fields.issuelinks) {
        implementedByCounter = 0
        // Expect at least one "is implemented by" link for each team
        // reqt.fields.issuelinks.forEach((link) => {
        for (let i = 0; i < reqt.fields.issuelinks.length; i++) {
          const link = reqt.fields.issuelinks[i]
          if (link.inwardIssue) {
            if (link.type.inward === 'is implemented by') {
              implementedByCounter += 1
              implementedByKeys.push(link.inwardIssue.key)
            }
            res.write(`${link.type.inward} <a href='${config.get('jira.protocol')}://${config.get('jira.host')
              }/browse/${link.inwardIssue.key}' target='_blank' title='${link.inwardIssue.fields.summary}'>${link.inwardIssue.key}</a><br>`)
            inwardLinks[link.type.inward]
              ?
              inwardLinks[link.type.inward] += 1
              :
              inwardLinks[link.type.inward] = 1
          } else { // outwardIssue
            res.write(`${link.type.outward} <a href='${config.get('jira.protocol')}://${config.get('jira.host')
              }/browse/${link.outwardIssue.key}' target='_blank' title='${link.outwardIssue.fields.summary}'>${link.outwardIssue.key}</a><br>`)
          }
        }
        // })

        // Not Rejected
        if (reqt.fields.status.name === 'Rejected') {
          res.write(`n/a`)
        } else {
          // Sufficient implemented by links?
          if (teamCount > 0) {
            if (implementedByCounter >= teamCount) {
              res.write(`<b style='color: green;'>Possibly sufficient</b>`)
            } else {
              res.write(`<b style='color: darkred;'>Insufficient</b>`)
            }
          } else {
            res.write(`<span style='color: red; font-style: italic;'>No Team Set</span>`)
          }
        }
      } else {
        res.write(`None`)
      }
      res.write(`</td>`)
      // res.write(`<td>${reqt.fields.labels.join(',')}</td>`)
      res.write('<td class="childrenCol">')
      for (let i = 0; i < implementedByKeys.length; i++) {
        const key = implementedByKeys[i];
        res.write(`<p>${key}: `)
        try {
          const kids = key in Object.keys(childrenCache) ? childrenCache[key] : await getChildren(key)
          if (kids.issues && kids.issues.length > 0) {
            // debug(`kids/fields for ${key}: `, kids.issues[0].fields)
            const issueList = []
            kids.issues.forEach((issue) => {
              const link = buildLink(
                issue.key,
                issue.fields.status.name,
                issue.fields.issuetype.iconUrl,
                issue.fields.summary,
                issue.fields.assignee.displayName,
                issue.fields.status.name,
                false
              )
              issueList.push(link)
            })
            res.write(issueList.join(''))
          } else {
            res.write('none')
          }
          childrenCache[key] = kids
        } catch (err) {
          res.write(`<!-- ERROR: ${err.message} -->`)
        }
        res.write('</p>')
      }
      res.write('</td>')

      res.write('</tr>')
    }
    res.write(`</tbody></table>`)
    debug('done with table')
    // debug(inwardLinks)
  } catch (err) {
    debug(err)
    res.write(`<em>error</em><!-- ${err} -->`)
  }
  res.write(buildHtmlFooter())
  res.end()
  return next()
})

server.get('/dashboard', async (req, res, next) => {
  await dashboard.build()
  if (req.query && req.query.format == 'html') {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.write(buildHtmlHeader('Dashboard', false))
    res.write(buildPageHeader('Dashboard'))
    res.write(dashboard.fetch("html"))
    res.write(buildHtmlFooter())
    res.end()
  } else {
    res.send(dashboard.fetch())
  }
  return next()
})

// server.get('/projects', async (req, res, next) => {
//   const projects = await jsr.getProjects()
//   if (req.query && req.query.format == 'html') {
//     res.writeHead(200, { 'Content-Type': 'text/html' })
//     res.write(buildHtmlHeader('Projects', false))
//     res.write(buildPageHeader('Projects'))
//     res.write(JiraStatus.printList(projects, 'name', true))
//     res.write(buildHtmlFooter())
//     res.end()
//   } else {
//     res.send(projects)
//   }
//   return next()
// })

function buildLink(
  issueKey,
  statusName,
  issueTypeIconUrl,
  issueSummary,
  issueOwner,
  issueStatus,
  hideName = false
) {
  const title = `${issueKey}: ${issueSummary} (${issueOwner}; ${issueStatus})`
  const displayTitle = hideName ? '' : title
  return `<span class='${hideName ? '' : 'issueComboLink lineicon'}'><a href='${config.get('jira.protocol')}://${config.get('jira.host')
    }/browse/${issueKey}' target='_blank'><img class='icon ${JiraStatus.formatCssClassName(
      statusName
    )}' src='${issueTypeIconUrl}' title='${cleanText(
      title
    )}')/><span class='${hideName ? '' : 'issueName'}'/>${displayTitle}</span></a></span>`
}

function startHtml(res) {
  res.writeHead(200, { 'Content-Type': 'text/html' })
}

server.get('/projects', async (req, res, next) => {
  const fullView = req.query && req.query.full && req.query.full == 'true'
  const projectData = await jsr.getProjects(fullView)

  // Save project data locally
  const nowMs = new Date().getTime()
  ls.setItem(`projectData-${nowMs}`, JSON.stringify(projectData))

  if (req.query && req.query.format == 'html') {
    startHtml(res)
    const title = `Project Data (${fullView ? 'Expanded' : 'Simple'})`
    res.write(buildHtmlHeader(title, false))
    res.write(buildPageHeader(title, config.get('jira.host')))
    if (fullView) {
      res.write(await JiraStatus.formatProjectDataHtml(projectData))
    } else {
      debug(projectData)
      // TODO: Fix this URL
      // res.write(JiraStatus.printList(projectData, 'key', true, "html", '/projects/'))
      res.write(JiraStatus.printList(projectData, 'key', true))
    }
    res.write(buildHtmlFooter())
    res.end()
  } else {
    res.send(projectData)
    res.end()
  }
  return next()
})

server.get('/fields', async (req, res, next) => {
  debug('/fields called...')
  const data = await JiraStatus.getFields()
  if (req.query && req.query.format == 'html') {
    startHtml(res)
    res.write(buildHtmlHeader('Field List', false))
    res.write(buildPageHeader('Field List', config.get('jira.host')))
    res.write(await JiraStatus.formatFieldsHtml(data))
    res.write(buildHtmlFooter())
  } else {
    // debug(typeof data)
    res.send(data)
    res.end()
  }
  return next()
})

server.get('/filter', async (req, res, next) => {
  debug('/filter called...')
  const data = await jsr.getFilter(req.query.id)
  // .then((data) => {
  debug(`getFilter returned...`)

  const newHeader = `${data.name}: Filter #${req.query.id}`
  res.write(buildHtmlHeader(newHeader))
  res.write(buildPageHeader(data.name, `Filter: ${req.query.id}`))
  debug(`about to run genericJiraSearch(${data.jql}, 99)`)
  jsr._genericJiraSearch(data.jql, 99)
    .then((e) => {
      let stats = {
        Epic: { Open: 0, Active: 0, Closed: 0, Stopped: 0 },
        Story: { Open: 0, Active: 0, Closed: 0, Stopped: 0 },
        Task: { Open: 0, Active: 0, Closed: 0, Stopped: 0 },
        'Sub-task': { Open: 0, Active: 0, Closed: 0, Stopped: 0 },
        Bug: { Open: 0, Active: 0, Closed: 0, Stopped: 0 }
      }

      let results = {
        Epics: [],
        Stories: [],
        Tasks: [],
        Bugs: [],
        'Sub-tasks': []
      }
      let contents = []

      for (let x = 0; x < e.issues.length; x++) {
        let issue = e.issues[x]
        let ndx = x

        let owner = 'TBD'
        try {
          owner = issue.fields.assignee.displayName
        } catch (err) {
          owner = 'unassigned'
        }

        let statusName = 'unknown'
        try {
          statusName = issue.fields.status.name
        } catch (err) {
          statusName = 'unknown'
        }

        switch (issue.fields.issuetype.name) {
          case 'Epic':
            results.Epics.push(
              buildLink(
                issue.key,
                issue.fields.status.name,
                issue.fields.issuetype.iconUrl,
                issue.fields.summary,
                owner,
                statusName
              )
            )
            debug(`Sub-task ${issue.key}...`)
            stats = updateStats(stats, 'Epic', statusName)
            break
          case 'Sub-task':
            results['Sub-tasks'].push(
              buildLink(
                issue.key,
                issue.fields.status.name,
                issue.fields.issuetype.iconUrl,
                issue.fields.summary,
                owner,
                statusName
              )
            )
            debug(`Sub-task ${issue.key}...`)
            stats = updateStats(stats, 'Sub-task', statusName)
            break
          case 'Task':
            results.Tasks.push(
              buildLink(
                issue.key,
                issue.fields.status.name,
                issue.fields.issuetype.iconUrl,
                issue.fields.summary,
                owner,
                statusName
              )
            )
            debug(`Task ${issue.key}...`)
            stats = updateStats(stats, 'Task', statusName)
            break
          case 'Story':
            debug(
              `...adding Story ${issue.key} to results.Stories (increasing size (was ${results.Stories.length}) by 1)`
            )
            results.Stories.push(
              buildLink(
                issue.key,
                issue.fields.status.name,
                issue.fields.issuetype.iconUrl,
                issue.fields.summary,
                owner,
                statusName
              )
            )
            debug(`Story ${issue.key}...`)
            stats = updateStats(stats, 'Story', statusName)
            break
          case 'Bug':
            results.Bugs.push(
              buildLink(
                issue.key,
                issue.fields.status.name,
                issue.fields.issuetype.iconUrl,
                issue.fields.summary,
                owner,
                statusName
              )
            )
            debug(`Bug ${issue.key}...`)
            stats = updateStats(stats, 'Bug', statusName)
            break
          default:
            debug(
              `ERR ****** unrecognized issuetype: ${issue.fields.issuetype.name}`
            )
        }
      }

      debug(`stats: `, stats)

      // charts
      buildPieCharts(stats).then((charts) => {
        res.write(charts)
        // icons
        res.write(
          '<hr><div class="children">' +
          results.Epics.join('') +
          results.Stories.join('') +
          results.Tasks.join('') +
          results['Sub-tasks'].join('') +
          results.Bugs.join('') +
          '</div>'
        )
        res.write('</div>')
        res.write('<hr>')
        res.write(buildLegend())
        res.write(buildHtmlFooter())
        res.end()
        return next()
      })
    })
    .catch((err) => {
      debug(`error in generic search: ${err}`)
      res.end()
      return
    })
  // })
  // .catch((err) => {
  //   debug(`getFilter error...`)
  //   debug(err)
  //   res.write(buildHtmlHeader(`Filter: ${req.query.id}`))
  //   res.write(`<em>Error</em> ${err}`)
  //   res.end()
  //   return
  // })
})

server.get('/epics', (req, res, next) => {
  let epicIdRequested = req.query.id
  let promises = buildEpicPromisesArray(epicIdRequested)

  res.write(buildHtmlHeader(`Epics: ${epicIdRequested}`))
  res.write(buildPageHeader('Status Page', epicIdRequested))

  Promise.all(promises)
    .then((results) => {
      res.write(buildStylesheet())

      debug(results)

      let stats = {
        Epic: { Open: 0, Active: 0, Closed: 0, Stopped: 0 },
        Story: { Open: 0, Active: 0, Closed: 0, Stopped: 0 },
        Task: { Open: 0, Active: 0, Closed: 0, Stopped: 0 },
        'Sub-task': { Open: 0, Active: 0, Closed: 0, Stopped: 0 },
        Bug: { Open: 0, Active: 0, Closed: 0, Stopped: 0 }
      }

      let details = []

      details.push(`<ul class="list-group list-group-flush">`)
      results.forEach((e) => {
        // for getEpicAndChildren(x), the Epic is always the last Issue in the issues list

        // TODO: Fix this hack
        let epicData = {}
        if (e.issues[0].key == epicIdRequested) {
          epicData = e.issues.shift()
        } else {
          epicData = e.issues.pop()
        }

        debug(`processing ${epicData.key}...`)

        let owner = 'TBD'
        try {
          owner = epicData.fields.assignee.displayName
        } catch (err) {
          owner = 'unassigned'
        }

        let statusName = 'unknown'
        try {
          statusName = epicData.fields.status.name
        } catch (err) {
          debug(`... unrecognized status for ${epicData.key}!`)
          statusName = 'unknown'
        }

        let resultCtr = {
          Epics: [],
          Stories: [],
          Tasks: [],
          'Sub-tasks': [],
          Bugs: []
        }

        details.push(
          `<li class="list-group-item d-flex justify-content-between align-items" style="align-self: start;">`
        )
        details.push(
          `<a href='${config.get('jira.protocol')}://${config.get('jira.host')}/browse/${epicData.key
          }' target='_blank'><img class='icon ${JiraStatus.formatCssClassName(
            statusName
          )}' src='${epicData.fields.issuetype.iconUrl}' title='${cleanText(
            epicData.key
          )}: ${cleanText(
            epicData.fields.summary
          )} (${owner}; ${statusName})'/></a>`
        )
        details.push(`<span class='issueName'>${epicData.key}: ${epicData.fields.summary}</span>`)
        stats = updateStats(stats, epicData.fields.issuetype.name, statusName)
        switch (epicData.fields.issuetype.name) {
          case 'Epic':
            resultCtr['Epics'].push('')
            break
          case 'Story':
            resultCtr['Stories'].push('')
            break
          case 'Task':
            resultCtr['Tasks'].push('')
            break
          case 'Sub-Task':
            resultCtr['Sub-tasks'].push('')
            break
          case 'Bugs':
            resultCtr['Bugs'].push('')
            break
          default:
            break
        }

        e.issues.forEach((issue, ndx) => {
          let owner = 'TBD'
          try {
            owner = issue.fields.assignee.displayName
          } catch (err) {
            owner = 'unassigned'
          }

          let statusName = 'unknown'
          try {
            statusName = issue.fields.status.name
          } catch (err) {
            statusName = 'unknown'
          }

          switch (issue.fields.issuetype.name) {
            case 'Epic':
              resultCtr['Epics'].push(
                `<a href='${config.get('jira.protocol')}://${config.get('jira.host')
                }/browse/${issue.key
                }' target='_blank'><img class='icon ${JiraStatus.formatCssClassName(
                  issue.fields.status.name
                )}' src='${issue.fields.issuetype.iconUrl}' title='${cleanText(
                  issue.key
                )}: ${cleanText(
                  issue.fields.summary
                )} (${owner}; ${statusName})'/></a>`
              )
              debug(`Epic ${issue.key}...`)
              stats = updateStats(stats, 'Epic', statusName)
              break
            case 'Story':
              resultCtr['Stories'].push(
                `<a href='${config.get('jira.protocol')}://${config.get('jira.host')
                }/browse/${issue.key
                }' target='_blank'><img class='icon ${JiraStatus.formatCssClassName(
                  issue.fields.status.name
                )}' src='${issue.fields.issuetype.iconUrl}' title='${cleanText(
                  issue.key
                )}: ${cleanText(
                  issue.fields.summary
                )} (${owner}; ${statusName})'/></a>`
              )
              debug(`Story ${issue.key}...`)
              stats = updateStats(stats, 'Story', statusName)
              break
            case 'Task':
              resultCtr['Tasks'].push(
                `<a href='${config.get('jira.protocol')}://${config.get('jira.host')
                }/browse/${issue.key
                }' target='_blank'><img class='icon ${JiraStatus.formatCssClassName(
                  issue.fields.status.name
                )}' src='${issue.fields.issuetype.iconUrl}' title='${cleanText(
                  issue.key
                )}: ${cleanText(
                  issue.fields.summary
                )} (${owner}; ${statusName})'/></a>`
              )
              debug(`Task ${issue.key}...`)
              stats = updateStats(stats, 'Task', statusName)
              break
            case 'Sub-task':
              resultCtr['Sub-tasks'].push(
                `<a href='${config.get('jira.protocol')}://${config.get('jira.host')
                }/browse/${issue.key
                }' target='_blank'><img class='icon ${JiraStatus.formatCssClassName(
                  issue.fields.status.name
                )}' src='${issue.fields.issuetype.iconUrl}' title='${cleanText(
                  issue.key
                )}: ${cleanText(
                  issue.fields.summary
                )} (${owner}; ${statusName})'/></a>`
              )
              debug(`Sub-task ${issue.key}...`)
              stats = updateStats(stats, 'Sub-task', statusName)
              break
            case 'Bug':
              resultCtr['Bugs'].push(
                `<a href='${config.get('jira.protocol')}://${config.get('jira.host')
                }/browse/${issue.key
                }' target='_blank'><img class='icon ${JiraStatus.formatCssClassName(
                  issue.fields.status.name
                )}' src='${issue.fields.issuetype.iconUrl}' title='${cleanText(
                  issue.key
                )}: ${cleanText(
                  issue.fields.summary
                )} (${owner}; ${statusName})'/></a>`
              )
              debug(`Bug ${issue.key}...`)
              stats = updateStats(stats, 'Bug', statusName)
              break
            default:
              debug(`unrecognized issuetype: ${issue.fields.issuetype.name}`)
          }
        })
        details.push(`<div class="children">
                ${resultCtr['Epics'].join('')}
                ${resultCtr['Stories'].join('')}
                ${resultCtr['Tasks'].join('')}
                ${resultCtr['Sub-tasks'].join('')}
                ${resultCtr['Bugs'].join('')}
                <span class="badge badge-dark rounded-pill">
                    ${resultCtr['Epics'].length}
                </span>
                <span class="badge badge-dark rounded-pill">
                    ${resultCtr['Stories'].length}
                </span>
                <span class="badge badge-dark rounded-pill">
                    ${resultCtr['Tasks'].length}
                </span>
                <span class="badge badge-dark rounded-pill">
                    ${resultCtr['Sub-tasks'].length}
                </span>
                <span class="badge badge-dark rounded-pill">
                    ${resultCtr['Bugs'].length}
                </span></div>`)
        details.push(`</li>`)
      })
      details.push(`</ul>`)

      debug(`buildPieCharts() called with ${stats}`)

      buildPieCharts(stats).then((charts) => {
        res.write(charts)
        res.write('<hr>')
        res.write(buildLegend())
        res.write('<hr>')
        res.write(details.join(''))
        res.write(buildHtmlFooter())
        res.end()
        return next()
      })
    })
    .catch((err) => {
      debug(`error`)
      debug(err)
      res.write('error')
      res.end()
      return
    })
})

server.get('/chart', (req, res, next) => {
  let jsrCLM = jsr.getChartLinkMaker(config).reset()
  res.writeHead(200, { 'Content-Type': 'text/html' })
  const typeFilter = req.query.type || false
  if (typeFilter) {
    res.write(`<H1>${typeFilter}</H1>`)
  } else {
    res.write(`<H1>Status Chart (no filter)</H1>`)
  }

  debug(`typeFilter: ${typeFilter}`)

  let dates = jdr.getDates()
  // Don't modify the original data
  // let series = JSON.parse(JSON.stringify(jdr.getSeriesData()))
  // n.b. es9 ... is much faster (10x) than JSON.parse/stringify
  let series = { ...jdr.getSeriesData(typeFilter) }
  let statuses = Object.keys(series)

  let reZero = false
  let reZeroData = []

  try {
    jsrCLM.setCategories(dates)

    debug('...in /temp about to go through all statuses')
    if (req.query.rezero) {
      debug(`reset = ${req.query.rezero}`)
      reZero = req.query.rezero
      statuses.forEach((s, ndx) => {
        if (reZero.includes(s)) {
          debug(`reZeroing ${s}: First data point = ${series[s][0]}`)
          reZeroData[s] = series[s][0]
          series[s] = series[s].map((x) => x - reZeroData[s])
        }
      })
    }

    statuses.forEach((s, ndx) => {
      if (req.query.exclude) {
        if (!req.query.exclude.includes(s)) {
          debug(`......exclusion doesn't match -- adding series ${s}`)
          jsrCLM.addSeries(s, series[s])
        } else {
          debug(`......exclusion matches -- skipping series ${s}`)
        }
      } else {
        debug(`......no exclusion -- adding series ${s}`)
        jsrCLM.addSeries(s, series[s])
      }
    })

    jsrCLM
      .setLineChart()
      // .setFill(true)
      .setFill(false)

      .buildChartImgTag()
      .then((link) => {
        debug(`buildChartImgTag returned ${link}`)
        res.write(link)
      })
      .catch((err) => {
        debug(`Error caught in buildChartImgTag() = ${err}`)
        res.write(`<EM>Error</EM>: ${err}`)
      })
      .finally(() => {
        res.end()
      })
  } catch (err) {
    res.write(`${err}`)
    res.end()
    return next()
  }
})

server.get('/links', (req, res, next) => {
  debug(`/links called w/ ID of ${req.query.id}`)
  jsr
    .getLinks(req.query.id)
    .then((issueResult) => {
      if (req.query.format && req.query.format == 'html') {

        const title = `Links for ${req.query.id}`
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.write(buildHtmlHeader(title, false))
        res.write(buildPageHeader(title))
        res.write(MermaidNodes.buildMermaidLinkChart(issueResult, `/links?format=html&id=`))
        res.write(buildHtmlFooter())
      } else {
        debug(`writing to json`)
        res.send(issueResult.issuelinks)
      }
      res.end()
    })
    .finally(() => {
      return next()
    })
})


/*
 ************** CACHE-RELATED ENDPOINTS **************
 */

server.get('/cacheJSR', (req, res, next) => {
  res.send(jdr.getCacheObject(false))
  return
})

server.get('/reread-cacheJSR', (req, res, next) => {
  res.send(`reread`)
  return next()
})

server.get('/refresh-cacheJSR', (req, res, next) => {
  const updates = jdr.reloadCache(jdr.refresh())
  res.send(`refreshed ${updates}`)
  return next()
})

server.get('/rebuild-cacheJSR', (req, res, next) => {
  const updates = jdr.reloadCache(jdr.rebuild())
  res.send(`rebuilt ${updates}`)
  return next()
})

server.get('/resetJSR', (req, res, next) => {
  jsr = new JSR()
  jdr = new JiraDataReader()
  res.redirect('/chart', next)
  return
})

server.get('/wipe-cacheJSR', (req, res, next) => {
  jdr.getCacheObject().wipe(true)
  res.send(`wiped`)
  return next()
})

server.get('/datafilesJSR', (req, res, next) => {
  try {
    let summary = jdr.getDataSummary()
    res.send(summary)
  } catch (err) {
    res.send(500, err)
  }
  return next()
})

module.exports = server
