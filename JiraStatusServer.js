'use strict'
const debug = require('debug')('JiraStatusServer')
const d = require('./dateExtension')
const restify = require('restify')
const restifyErrors = require('restify-errors')
const corsMiddleware = require('restify-cors-middleware')
const XXH = require('xxhashjs')

const NodeCache = require('node-cache')
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 })

const config = require('config')
const NONE = 'none'

const mermaidConfig = require('./config/mermaid-config')
const MermaidNodes = require('./MermaidNodes')
const mermaid = new MermaidNodes()

const JiraStatus = require('./JiraStatus')

const JSR = require('./JiraStatusReporter')
let jsr = new JSR()

const JiraDataReader = require('./JiraDataReader')
let jdr = new JiraDataReader()

const Dashboard = require('./Dashboard')
const { convertSecondsToDays } = require("./jiraUtils")
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
  const title = 'Jira Status Reporter'
  res.write(buildHtmlHeader(title, false))
  res.write(buildPageHeader(title, 'Available Endpoints'))
  res.write(`<ul>
  <li><a href='/burndown'>Burndown chart</a> (HTML)</li>
  <li><a href='/chart?exclude=DEAD'>Chart</a> (excluding DEAD issues) (HTML)</li>
  <li>Children: Requires Jira key parameter ('children/ABC-1234') (JSON)</li>
  <li><a href='/components'>Components</a> (JSON)</li>
  <li>Config (<a href='/config'>JSON</a> or <a href='/config?format=html'>HTML</a>)</li>
  <li>Dashboard (<a href='/dashboard'>JSON</a> or <a href='/dashboard?format=html'>HTML</a>)</li>
  <li><a href='/dates'>Dates</a> (JSON)</li>
  <li>Epics: Requires Jira key parameter ('?id=ABC-1234')</li>
  <li><a href='/estimates'>Estimates</a> (HTML)</li>
  <li>Fields (<a href='/fields'>JSON</a> or <a href='/fields?format=html'>HTML</a>)</li>
  <li>Groups (<a href='/groups'>JSON</a> or <a href='/groups?format=html'>HTML</a>)</li>
  <li>Links (<a href='/links'>JSON</a> or <a href='/links?format=html'>HTML/Mermaid</a>): Requires Jira key parameter ('?id=ABC-1234')</li>
  <li>Progress: Requires Jira release ID ('release/111111') (HTML)</li>
  <li>Projects (<a href='/projects'>JSON</a> or <a href='/projects?format=html'>HTML</a>)</li>
  <li>Query</li>
  <li>Releases (<a href='/releases'>JSON</a> or <a href='/releases?format=html'>HTML</a>)</li>
  <li>Report: Project-specific; Requires Jira project name ('/PROJECT_NAME') (JSON)</li>
  <li><a href='/requirements'>Requirements</a> (HTML)</li>
  <li>Unestimated (<a href='/unestimated'>JSON</a> or <a href='/unestimated?format=html'>HTML</a>)</li>`)

  // Print the cache management links if the Admin param is set
  if (req.query && req.query.admin && req.query.admin == (config.has('adminKey') ? config.get('adminKey') : 'yes')) {
    res.write(`<h2>Cache Management</h2>
    <li><a href='/cache/flush'>Flush</a></li>
    <li><a href='/cache/stats'>Stats</a></li>
    <li><a href='/cacheJSR'>JSR</a></li>
    <li><a href='/datafilesJSR'>Data files (JSR)</a></li>
    <li><a href='/homedir'>Home directory</a></li>
    <li><a href='/rebuild-cacheJSR'>Rebuild Cache JSR</a></li>
    <li><a href='/refresh-cacheJSR'>Refresh Cache JSR</a></li>
    <li><a href='/reread-cacheJSR'>Re-read Cache JSR</a></li>
    <li><a href='/resetJSR'>Reset JSR</a></li>
    <li><a href='/series'>Series</a>: Per-Status counts</li>
    <li><a href='/wipe-cacheJSR'>Wipe Cache JSR</a></li>
    </ul>`)
  }
  res.write(buildHtmlFooter())
  debug(`done with homepage`)
  res.end()
  return next()
})

server.get('/count/', async (req, res, next) => {
  const count = await jsr.bareQueryCount(req.query.q)
  res.send({ count: count })
  return next()
})

server.get('/report/:project', (req, res, next) => {
  debug(`/report/${req.params.project} called`)
  JiraStatus.report(req.params.project)
    .then((response) => {
      // debug(`report response = `, response)
      res.send(response)
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
    res.end()
  } else {
    res.send(configDetails)
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

function startHtml(res) {
  res.writeHead(200, { 'Content-Type': 'text/html' })
}

function buildHtmlHeader(title = '', showButtons = true) {
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

  // Bootstrap 5 alpha
  // const bootstrapCss = '<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.0-beta1/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-giJF6kkoqNQ00vy+HMDP7azOuL0xtbfIcaT9wjKHr8RbDVddVHyTfAAsrekwKmP1" crossorigin="anonymous">'

  // Bootstrap 4.5.2
  const bootstrapCss = '<link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" integrity="sha384-JcKb8q3iqJ61gNV9KGb8thSsNjpSL0n8PARn9HuZOnIxN0hoP+VmmDGMN5t9UJ0Z" crossorigin="anonymous">'

  const jqueryJs = '<script src="https://code.jquery.com/jquery-3.5.1.min.js" integrity="sha256-9/aliU8dGd2tb6OSsuzixeV4y/faTqgFtohetphbbj0=" crossorigin="anonymous"></script>'

  return `<!doctype html><html lang="en"><head><title>${title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">

        <!-- Bootstrap CSS -->
        ${bootstrapCss}
        ${jqueryJs}
        ${buildStylesheet()}
        ${buildButtonJs()}

        ${JiraStatus.getFontawesomeJsLink()}

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

    .text-center { text-align: center; }
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
  // return(`<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.0-beta1/dist/js/bootstrap.bundle.min.js" integrity="sha384-ygbV9kiqUc6oa4msXn9868pTtWMgiQaeYH7/t7LECLbyPA2x65Kgf80OJFdroafW" crossorigin="anonymous"></script>
  // <script>
  //   var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-toggle="tooltip"]'))
  //   var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
  //     return new bootstrap.Tooltip(tooltipTriggerEl)
  //   })
  // </script>`)

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

/**
 * Replace troublesome characters (', ", >, <) with HTML equivalents
 * For use with Title attribute values
 *
 * @param {string} t Original string
 * @returns {string} newText Cleaned text string
 */
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

/**
 * Create simple Bootstrap button for consistency
 *
 * @param {string} label Button text
 * @param {string} [link=false] HREF (if false, not linked)
 * @param {boolean} [active=true] Active button?
 * @returns HTML string - either <a> or <button> depending on the target value
 */
function simpleButton(label, link = false, active = true, size = 'sm', extraClasses = '', float = '', onClickEvent = false) {
  // <button type="button" class="btn btn-secondary .disabled" disabled aria-disabled="true">${c}</button>
  let onclick = onClickEvent ? ` onClick="${onClickEvent}"` : ''
  let classes = `btn ${size ? 'btn-${size}' : ''} ${float ? 'float-${float}' : ''} btn-link ${extraClasses} ${active ? '' : '.disabled'}`
  let disabled = active ? '' : 'disabled aria-disabled="true"'

  if (link) {
    return(`<a href='${link}' class='${classes}' ${disabled} ${onclick}>${label}</a>`)
  } else {
    return(`<button type='button' class='${classes}' ${disabled} ${onclick}>${label}</button>`)
  }
}

/**
 * Get total estimates for all stories in a single Epic
 *
 * @param {string} epicKey Jira key
 * @returns Object containing all Story estimate totals in that Epic
 */
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

/**
 * Get details on all the versions defined in the Jira project
 *
 * @param {string} [flushCache=false] Force flush rebuild
 * @returns string JSON array of versions from Jira /project/:id/versions
 */
async function getVersions(flushCache = false) {
  debug(`getVersions(${flushCache})...`)
  if (!cache.has('versions') || (flushCache && flushCache == 'yes')) {
    debug(`... +++ updating cache...`)
    cache.set('versions', await jsr.get(`/project/${config.project}/versions`))
  }
  debug(`... returning from cache...`)
  return(cache.get('versions'))
}

/**
 * Compile per-Component stats on work estimates and completed
 *
 * @param {object} issues Result of Jira query -- full dataset
 * @param {string} versionId Filter for the specific version (also used in the cache key)
 * @param {boolean} [storyOnly=false] Include only Stories?
 * @returns Object containing summary stats
 */
function compileVersionDetails(issues, versionId, storyOnly = false) {
  const versionDetails = { components: [], issues: issues, componentEstimates: {} }
  const components = [NONE]
  let componentEstimates = { 
    'none': {
      count: { Epic: 0, Story: 0, 'Sub-task': 0, Bug: 0, Task: 0, Requirement: 0 },
      progress: 0,
      total: 0,
      percent: 0,
      timeoriginalestimate: 0, 
      assignees: {}, 
      issues: [] 
    }
  }

  if (!cache.has(`versionDetails-${versionId}`)) {
    issues.forEach((issue) => {
      // Store components
      if (issue.fields.components && issue.fields.components.length > 0) {
        // debug(issue.fields.components.length)
        let issueComponents = issue.fields.components.map(x => x.name)
        issueComponents.forEach((c) => {
          if (!components.includes(c)) { 
            components.push(c)
            componentEstimates[c] = { count: { Epic: 0, Story: 0, 'Sub-task': 0, Bug: 0, Task: 0, Requirement: 0 }, progress: 0, total: 0, percent: 0, timeoriginalestimate: 0, assignees: {}, issues: [] }
          }
          // Update component estimates
          componentEstimates[c].progress += issue.fields.progress.progress
          componentEstimates[c].total += issue.fields.progress.total
          componentEstimates[c].timeoriginalestimate += issue.fields.timeoriginalestimate
          componentEstimates[c].count[issue.fields.issuetype.name]++
          let assignee
          if (issue.fields.assignee) {
            assignee = issue.fields.assignee.displayName
          } else {
            assignee = NONE
            // debug(`assignee set to ${assignee}`)
          }
          if (!Object.keys(componentEstimates[c].assignees).includes(assignee)) {
            componentEstimates[c].assignees[assignee] = {
              Epic: { progress: 0, total: 0, count: 0 },
              Story: { progress: 0, total: 0, count: 0 },
              'Sub-task': { progress: 0, total: 0, count: 0 },
              Bug: { progress: 0, total: 0, count: 0 },
              Task: { progress: 0, total: 0, count: 0 },
              Requirement: { progress: 0, total: 0, count: 0 }
            }
          }
          
          // debug(c, assignee, issue.fields.issuetype.name, issue.fields.progress.progress)
          componentEstimates[c].assignees[assignee][issue.fields.issuetype.name].progress += issue.fields.progress.progress
          componentEstimates[c].assignees[assignee][issue.fields.issuetype.name].total += issue.fields.progress.total
          componentEstimates[c].assignees[assignee][issue.fields.issuetype.name].count += 1
          componentEstimates[c].count[issue.fields.issuetype.name] += 1
        })
      } else {            // No component set, so record this to 'none'
        // debug(`${issue.key} NONE: `, issue.fields.progress.progress, issue.fields.progress.total)
        componentEstimates[NONE].progress += issue.fields.progress.progress
        componentEstimates[NONE].total += issue.fields.progress.total
        componentEstimates[NONE].timeoriginalestimate += issue.fields.timeoriginalestimate

        let assignee
        if (issue.fields.assignee) {
          assignee = issue.fields.assignee.displayName
        } else {
          assignee = NONE
          // debug(`assignee set to ${assignee}`)
        }
        // debug(`componentEstimates[${NONE}]: `, componentEstimates.NONE)
        if (!Object.keys(componentEstimates[NONE].assignees).includes(assignee)) {
          componentEstimates[NONE].assignees[assignee] = {
            Epic: { progress: 0, total: 0, count: 0 },
            Story: { progress: 0, total: 0, count: 0 },
            'Sub-task': { progress: 0, total: 0, count: 0 },
            Bug: { progress: 0, total: 0, count: 0 },
            Task: { progress: 0, total: 0, count: 0 },
            Requirement: { progress: 0, total: 0, count: 0 }
          }
        }
        componentEstimates[NONE].assignees[assignee][issue.fields.issuetype.name].progress += issue.fields.progress.progress
        componentEstimates[NONE].assignees[assignee][issue.fields.issuetype.name].total += issue.fields.progress.total
        componentEstimates[NONE].assignees[assignee][issue.fields.issuetype.name].count += 1
        componentEstimates[NONE].count[issue.fields.issuetype.name] += 1
      }
    })

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

/**
 * Compile per-User stats on work estimates and completed
 *
 * @param {object} issues Result of Jira query -- full dataset
 * @returns Object containing summary stats
 */
function compileUserDetails(issues) {
  const userDetails = { openIssues: [], remainingEstimateTotal: 0 }
  if (!cache.has(`userDetails`)) {
    debug(`...compiling new userDetails object stats`)
    issues.forEach((issue) => {
      /*
       * Include if there is no exclusion list in the config file
       * OR
       * the issue Status is not in exclusion list 
       */
      if (!config.has('excludeFromEstimateQueries') || (!config.get('excludeFromEstimateQueries').includes(issue.status.name))) {
        let assignee = 'none' // Default in case there isn't a valid Assignee
        if (issue.fields.assignee && issue.fields.assignee.displayName) {
          assignee = issue.fields.assignee.displayName
        }

        if (!Object.keys(userDetails).includes(assignee)) {
          userDetails[assignee] = { openIssues: {}, remainingEstimateTotal: {} }
        }

        // TODO: Handle multiple fixVersion values (without double-counting?)
        let release = issue.fields.fixVersions.length ? issue.fields.fixVersions[0].name : 'none'

        // Assume that if the release isn't in the remainingEstimateTotal, it isn't in openIssues either
        if (!Object.keys(userDetails[assignee].remainingEstimateTotal).includes(release)) {
          userDetails[assignee].remainingEstimateTotal[release] = 0
          userDetails[assignee].openIssues[release] = []
        }

        userDetails[assignee].remainingEstimateTotal[release] += issue.fields.progress.total - issue.fields.progress.progress
        userDetails[assignee].openIssues[release].push(issue.fields.key)
      }
    })
    cache.set(`userDetails`, userDetails)

  } else {
    debug(`...returning userDetails cached value`)
    return(cache.get(`userDetails`))
  }
}

/**
 * Calculate the date X days from now
 *
 * @param {integer} dplus Number of days to add
 * @returns string (format: MM/DD/YYYY)
 */
function calcFutureDate(dplus) {
  const d = new Date()
  const dFuture = d.addBusinessDays(Math.round(dplus), true)
  return (`${dFuture.getMonth() + 1}/${dFuture.getDate()}/${dFuture.getFullYear()}`)
}

/**
 * Create an HTML HREF based on the provided parameters
 *
 * @param {string} issueKey Jira issue key
 * @param {string} statusName Jira Status value
 * @param {string} issueTypeIconUrl Link for type icon
 * @param {object} issueSummary Jira Summary
 * @param {string} issueOwner Jira Assignee
 * @param {string} issueStatus Jira Status
 * @param {boolean} [hideName=false] Display the Jira issue name or not
 * @returns HTML snippet with the full HREF
 */
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

/**
 * Get a list of all the Requirements in the active project.
 * Requirement == the Jira issue type name
 *
 * @returns Array of Jira objects
 */
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

/**
 * Get a list of all the Groups in the active Jira project
 *
 * @param {string} flushCache Wipe/refresh cache?
 * @returns Object from Jira /groups/picker
 */
async function getGroups(flushCache) {
  if (!cache.has('groups') || (flushCache && flushCache == 'yes')) {
    cache.set('groups', await jsr.get('/groups/picker?maxResults=50'))
  }
  return(cache.get('groups'))
}

/**
 * Get the names of all the Groups in the active Jira project with members
 *
 * @param {boolean} [flushCache=false] Wipe/refresh cache?
 * @returns Array of objects [ { name: <group_name>, members: [ <member_data> ] }]
 */
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

/**
 * Get the members of a specific group
 *
 * @param {string} groupName Name of the group (Required)
 * @returns Array of names
 */
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

/**
 * Get all the children for a supplied Epic
 *
 * @param {string} parentId Epic key
 * @returns Object
 */
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

server.get('/progress/:rel', async (req, res, next) => {
  let rel = req.params.rel || false

  debug(`rel: ${rel}
  query: `, req.query.exclude)

  if (rel) {
    let typesExcluded = []

    let jql_suffix = ''
    const pageTitle = 'Progress Report'
    res.write(buildHtmlHeader(pageTitle, false))
    res.write(buildPageHeader(pageTitle))
    try {
      let prevUserRemainSum = {} // Track user's total remaining work

      const versions = await getVersions(false)
      let version = versions.filter((v) => v.id == rel)[0]
      if (!version) { // Try to get release by name
        version = versions.filter((v) => v.name == rel)[0]
      }

      if (!version) { // Can't figure out the version, so croak
        throw new Error('Invalid release version provided. Please check the value and try again. (Either the numeric value or the string name are valid values.)')
      } else {
        // Convert the rel value to the numeric version id
        rel = version.id
      }
      
      res.write(`<h2>${version.name}</h2>`)
      res.write(`<h3>Release Date: ${version.releaseDate}</h2>`)

      const versionRelatedIssues = await jsr.get(`/version/${rel}/relatedIssueCounts`)
      const versionUnresolvedIssues = await jsr.get(`/version/${rel}/unresolvedIssueCount`)

      // debug(`versionRelatedIssues: `, versionRelatedIssues)
      // debug(`versionUnresolvedIssues: `, versionUnresolvedIssues)

      let versionIssues
      if (!cache.has(`versionIssues-${rel}`)) {
        // Base JQL
        const jql = `project=${config.project} AND fixVersion=${rel} `

        // Exclude any types?
        if ((config.releaseExcludeTypes && config.releaseExcludeTypes.length) || req.query.exclude) {
          debug(`req.query.exclude: ${req.query.exclude}
          config.releaseExcludeTypes: ${config.releaseExcludeTypes}`)
          if (req.query.exclude) {
            debug(`req.query.exclude: adding ${typeof req.query.exclude} ${req.query.exclude} to typesExcluded[]`)
            if (typeof req.query.exclude == 'string') {
              typesExcluded.push(req.query.exclude) 
            } else { // Assume array/object
              typesExcluded = typesExcluded.concat(req.query.exclude) 
            }
          }

          if (config.releaseExcludeTypes) {
            debug(`config.releaseExcludedTypes: adding ${config.releaseExcludeTypes.length} ${typeof config.releaseExcludeTypes} ${config.releaseExcludeTypes} to typesExcluded[]`)
            typesExcluded = typesExcluded.concat(config.releaseExcludeTypes)
          }

          debug(`typesExcluded: `, typesExcluded)
          
          jql_suffix += ` and issuetype not in ("${typesExcluded.join('","')}")`
        }
        debug(`jql: ${jql}${jql_suffix}`)

        versionIssues = await jsr._genericJiraSearch(jql + jql_suffix, 99, ['summary', 'issuetype', 'assignee', 'components', 'aggregateprogress', 'progress', 'timeoriginalestimate'])
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
      let versionDetails = compileVersionDetails(versionIssues.issues, rel)
      const COLUMNS = ['Component', 'Count', 'Completed', 'Remaining', '%/Finish', 'Original Est.']

      if (typesExcluded.length) {
        res.write(`<em>Excluding: ${typesExcluded.join(', ')}</em>`)
      } else {
        res.write(`<em>Showing all issue types</em>`)
      }

      // Start accordion
      // res.write(`<div class="accordion" id="progress-report">`)
      // Start Accordion block 1: component-table
      // 1. Header
      // res.write(`<div class="accordion-item">
      // <h2 class="accordion-header" id="component-table">
      // <button class="accordion-button" type="button" data-toggle="collapse" data-bs-target="#component-table-data" aria-expanded="true" aria-controls="component-table-data">
      // Component Table
      // </button></h2>`)
      // 2. Body
      // res.write(`<div id="component-table-data" class="accordion-collapse collapse show" aria-labelledby="component-table" data-bs-parent="#progress-report">
      // <div class="accordion-body">
      // `)

      // Start main table
      res.write(`<table style='width: auto !important;' class='table table-sm'><thead><tr><th>${COLUMNS.join('</th><th>')}</th></tr></thead><tbody>`)

      Object.keys(versionDetails.componentEstimates).sort().forEach((component) => {
        // Component row
        res.write(`<tr class='table-active'>
          <td>${component}</td>
          <td></td>
          <td class='summCell'>${convertSecondsToDays(versionDetails.componentEstimates[component].progress)}</td>
          <td class='summCell'>${convertSecondsToDays(versionDetails.componentEstimates[component].total)}</td>
          <td class='summCell'>${convertSecondsToDays(versionDetails.componentEstimates[component].percent)}</td>
          <td class='summCell'>${convertSecondsToDays(versionDetails.componentEstimates[component].timeoriginalestimate)}</td>
          </tr>`)

        // Assignee details/progress
        if (versionDetails.componentEstimates[component].assignees) {
          // debug(`assignees: `, versionDetails.componentEstimates[component].assignees)
          Object.keys(versionDetails.componentEstimates[component].assignees).sort().forEach((assignee) => {
            let resp = ''   // HTML response for rest of user's data
            let prog   = 0  // Temp holder for progress
            let tot    = 0  // Temp holder for total
            let remain = 0  // Temp holder for remaining work

            let progTooltip = `<em><b>Issue Stats for ${assignee}:</b></em><ul>`
            let progTooltipLen = 0
            let totalIssueCount = 0

            Object.keys(versionDetails.componentEstimates[component].assignees[assignee]).forEach((type) => {
              
              if (!Object.keys(prevUserRemainSum).includes(assignee)) {
                prevUserRemainSum[assignee] = { remaining: 0, openItems: [] }
              }

              prog += versionDetails.componentEstimates[component].assignees[assignee][type].progress
              tot += versionDetails.componentEstimates[component].assignees[assignee][type].total
              remain += versionDetails.componentEstimates[component].assignees[assignee][type].total - versionDetails.componentEstimates[component].assignees[assignee][type].progress

              // Update the remaining estimate for this user
              prevUserRemainSum[assignee].remaining += versionDetails.componentEstimates[component].assignees[assignee][type].total - versionDetails.componentEstimates[component].assignees[assignee][type].progress

              totalIssueCount += versionDetails.componentEstimates[component].assignees[assignee][type].count

              // If this component/user/type has any items, update the tooltip content
              if (versionDetails.componentEstimates[component].assignees[assignee][type].count) {
                progTooltip += `<li><em>${type}</em>: Count: ${versionDetails.componentEstimates[component].assignees[assignee][type].count}; Completed: ${convertSecondsToDays(versionDetails.componentEstimates[component].assignees[assignee][type].progress)}d; Total: ${convertSecondsToDays(versionDetails.componentEstimates[component].assignees[assignee][type].total)}d</li>`
                progTooltipLen++
              }
            })
            
            if (progTooltipLen > 0) {
              progTooltip += '' // '</ul>'
            } else {
              progTooltip = ''
            }

            // User row
            res.write(`<tr>
              <td class='smright' data-toggle="tooltip" data-html="true" title="${progTooltip}"><a href='${config.jira.protocol}://${config.jira.host}/issues/?jql=assignee${assignee == NONE ? ' is empty' : '="' + assignee + '"'}%20AND%20component${component == NONE ? ' is empty' : '="' + component + '"'}%20AND%20fixversion=${rel} ${jql_suffix}' target='_blank'>${assignee}</a></td>
              <td class='smcenter'>${totalIssueCount}</td>
              <td class='smcenter'>${convertSecondsToDays(prog)}</td>
              <td class='smcenter'>${convertSecondsToDays(remain)}</td>
              <td class='smcenter'>${tot > 0 ? calcFutureDate(convertSecondsToDays(prevUserRemainSum[assignee].remaining)) : ''}</td>
              <td class='smcenter'></td>
              </tr>`)
          })
        }
      })
      res.write('</tbody></table>')
      
      // End Accordion block 1: component-table
      // res.write('</div></div></div>')

      // Start Accordion block 2: user-table
      // 1. Header
      // res.write(`<div class="accordion-item">
      // <h2 class="accordion-header" id="user-table">
      // <button class="accordion-button" type="button" data-toggle="collapse" data-bs-target="#user-table-data" aria-expanded="true" aria-controls="user-table-data">
      // User Table
      // </button></h2>`)
      // 2. Body
      // res.write(`<div id="user-table-data" class="accordion-collapse collapse show" aria-labelledby="user-table" data-bs-parent="#progress-report">
      // <div class="accordion-body">
      // `)

      if (Object.keys(prevUserRemainSum).length) {
        res.write('<h2>User Remaining Work Forecast</h2>')
        res.write(`<table style='width: auto !important;' class='table table-sm table-striped'><thead><tr><th>${['User', 'Remaining Work', 'Finish Date'].join('</th><th>')}</th></tr></thead><tbody>`)
        Object.keys(prevUserRemainSum).sort().forEach((user) => {
          res.write(`<tr>
          <td><a href='${config.jira.protocol}://${config.jira.host}/issues/?jql=assignee${user == NONE ? ' is empty' : '="' + user + '"'}%20AND%20fixversion=${rel} ${jql_suffix}' target='_blank'>${user}</a></td>
          <td>${convertSecondsToDays(prevUserRemainSum[user].remaining)}</td>
          <td>${calcFutureDate(convertSecondsToDays(prevUserRemainSum[user].remaining))}</td>
          </tr>`)
        })
        res.write(`</tbody></table>`)
      } else {
        debug(`prevUserRemainSum NOT found!`)
      }

      // End Accordion block 2: user-table
      res.write('</div></div></div>')
      // End Accordion
      res.write('</div>')


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
        story.fields.assignee ? story.fields.assignee.displayName : NONE,
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
          if (!(assignee in assigneeStats)) {
            assigneeStats[assignee] = { progress: 0, total: 0, count: [], empty: [], rel: {} } 
          }

          assigneeStats[assignee].count.push(`${story.key} ${story.fields.summary} [${convertSecondsToDays(story.fields.aggregateprogress.progress)} of ${convertSecondsToDays(story.fields.aggregateprogress.total)}d]`)

          assigneeStats[assignee].progress += story.fields.aggregateprogress.progress
          assigneeStats[assignee].total += story.fields.aggregateprogress.total

          if (!Object.keys(assigneeStats[assignee]['rel']).includes(fixVersions)) {
            assigneeStats[assignee]['rel'][fixVersions] = { total: convertSecondsToDays(story.fields.aggregateprogress.total), progress: convertSecondsToDays(story.fields.aggregateprogress.progress) }
          } else { // Key already exists, so increment it
            assigneeStats[assignee]['rel'][fixVersions].total = assigneeStats[assignee]['rel'][fixVersions].total + convertSecondsToDays(story.fields.aggregateprogress.total)
            assigneeStats[assignee]['rel'][fixVersions].progress = assigneeStats[assignee]['rel'][fixVersions].progress + convertSecondsToDays(story.fields.aggregateprogress.progress)
          }

          if (story.fields.aggregateprogress.total == 0) { assigneeStats[assignee].empty.push(`${story.key} ${story.fields.summary}`) }
        } else { // No assignee
          // debug(`No assignee for ${story.key}`)
          res.write(`<td class='storyCol problem'>none</td>`)
          assigneeStats[NONE].count.push(`${story.key} ${story.fields.summary}`)
          assigneeStats[NONE].progress += story.fields.aggregateprogress.progress
          assigneeStats[NONE].total += story.fields.aggregateprogress.total
          if (assigneeStats.none.total == 0) { assigneeStats.none.empty.push(`${story.key} ${story.fields.summary}`) }
        }

        // Spent
        res.write(`<td class='spentCol'>${convertSecondsToDays(story.fields.aggregateprogress.progress)} d</td>`)
        // Total
        if (story.fields.aggregateprogress.total > 0) {
          res.write(`<td class='totalCol'>${convertSecondsToDays(story.fields.aggregateprogress.total)} d</td>`)
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
          <td>${convertSecondsToDays(releases[rel].progress)}</td>
          <td>${convertSecondsToDays(releases[rel].total)}</td>
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
        const titleContentCount = assigneeStats[a].count.length > 0 ? '<b>Total Story List</b><ol><li>' + assigneeStats[a].count.join('</li><li>') + '</ol>' : NONE
        const titleContentEmpty = assigneeStats[a].empty.length > 0 ? `<b>Unestimated Story list</b><ol><li>${assigneeStats[a].empty.join('</li><li>')}</ol>` : NONE

        res.write(`<tr>
          <td class='nameCol'>${a}</td>
          <td class='spentCol'>${assigneeStats[a].progress > 0 ? convertSecondsToDays(assigneeStats[a].progress) : 0} d</td>
          <td class='totalCol`)
        if (assigneeStats[a].total == 0) {
          res.write(` problem'>0d</td>`)
        } else {
          const days = convertSecondsToDays(assigneeStats[a].total)
          const endDate = calcFutureDate(convertSecondsToDays(assigneeStats[a].total - assigneeStats[a].progress))
          res.write(`'><span data-toggle="tooltip" data-html="true" title='${endDate}'>${days}d</span></td>`)
        }
        // Completed
        res.write(`<td class='completedCol'>${assigneeStats[a].total > 0 ? Math.round(100 * (assigneeStats[a].progress / assigneeStats[a].total)) : 0}%</td>`)
        // Missing Estimate
        res.write(`<td class='missingEstCol'><span data-toggle="tooltip" data-html="true" title="${titleContentEmpty}">${assigneeStats[a].empty.length}</span> of <span data-toggle="tooltip" data-html="true" title="Finish by ${titleContentCount}">${assigneeStats[a].count.length}</span> 
          (${assigneeStats[a].empty.length > 0 ? (100 * (assigneeStats[a].empty.length / assigneeStats[a].count.length)).toFixed(0) : 0}%)</td>`)

        // Releases details
        Object.keys(releases).sort().forEach((rel) => {
          // debug(`processing release data for user = ${a} rel = ${rel}`)
          // Print the user's numbers for this release
          if (Object.keys(assigneeStats[a]['rel']).includes(rel)) {
            // debug(`assigneeStats[a]['rel'][${rel}] = `, assigneeStats[a]['rel'][rel])
            const userProgress = assigneeStats[a]['rel'][rel].progress
            const userTotal = assigneeStats[a]['rel'][rel].total
            res.write(`<!-- ${rel} --><td>${userProgress} of <span data-toggle="tooltip" data-html="true" title="${calcFutureDate(userTotal)}">${userTotal}d</span></td>`)
          } else {
            res.write('<!-- no data --><td></td>')
          }
        })
        res.write(`</tr>`)
        // Sum of estimates by release
      })
      res.write(`<tr><td><em>Release Totals</em></td><td colspan=${USER_COLUMNS.length - 1}></td>`)
      Object.keys(releases).sort().forEach((rel) => {
        res.write(`<td><b>${convertSecondsToDays(releases[rel].progress)} of ${convertSecondsToDays(releases[rel].total)}d</b></td>`)
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
            res.write(NONE)
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

server.get('/assignments/:assignee', async (req, res, next) => {
  const projects = await jsr.getProjects()
  if (req.query && req.query.format == 'html') {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.write(buildHtmlHeader('Projects', false))
    res.write(buildPageHeader('Projects'))
    res.write(JiraStatus.printList(projects, 'name', true))
    res.write(buildHtmlFooter())
    res.end()
  } else {
    res.send(projects)
  }
  return next()
})


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

server.get('/burndownStats/:rel', async (req, res, next) => {
  let release = req.params.rel ? req.params.rel : ""
  debug(`/burndownStats/${release} called...`)
  res.send(await jdr.getBurndownStats(release))
  res.end()
  return next()  
})

server.get('/burndown', async (req, res, next) => {
  // In case someone tries to hit the bare burndown url...
  res.redirect('/burndown/', next)
})

server.get('/burndown/:rel', async (req, res, next) => {
  let release = req.params.rel ? req.params.rel : false
  let component = req.query.component ? req.query.component : false
  let forecast = req.query.forecast && req.query.forecast === "yes" ? req.query.forecast : false

  let jsrCLM = await jsr.getChartLinkMaker(config).reset()

  res.write(buildHtmlHeader('Burndown Chart', false))
  res.write(buildPageHeader('Burndown Chart'))
  
  let releaseList = await jdr.getReleaseListFromCache() // Cached versions
  let versionData = false
  let versionReleaseDate = false
  let workingDaysToRelease = false

  // Buttons to burndown chart for each release, including combined
  res.write(`<div style='display: flex; float: none;'>`)
  // Make sure the current page button isn't linked/active
  if (release) {
    res.write(simpleButton('All/Combined', '/burndown/'))

    // Get the release data from Jira
    versionData = await getVersions()
    // debug(`versionData == `, versionData)
    if (forecast && versionData.length) {
      // List of Jira versions
      versionData = versionData.filter((v) => v.name === release)
      if (!versionData.length) {
        debug(`... versionData is empty`)
        versionData = false
      } else {
        versionReleaseDate = versionData[0].releaseDate
        debug(`... versionData is NOT empty. versionReleaseDate: ${versionReleaseDate}`)
        let now = new Date()
        workingDaysToRelease = now.workingDaysFromNow(versionReleaseDate)
        debug(`versionData: `, versionData[0].releaseDate, workingDaysToRelease)
      }
    } else { // No versionData
      debug(`ERROR: No versionData!`)
      versionData = false
    }  
  } else {
    res.write(simpleButton('All/Combined', false, false))
  }
  releaseList.forEach((rel) => {
    let relName = rel === 'NONE' ? 'No release set' : rel
    // Make sure the current page button isn't linked/active
    if (release === rel) {
      res.write(simpleButton(relName, false, false))
    } else {
      res.write(simpleButton(relName, `/burndown/${rel}`, false))
    }
  })
  res.write(`</div>`)

  const burndown = await jdr.getBurndownStats(release, component)

  debug(`burndown statuses: `, Object.keys(burndown.stats).join(','))
  // Build the data object based on the burndown data
  const data = {}
  Object.keys(burndown.stats).forEach((status) => {
    status.replace(/\s/g, '')
    data[status] = burndown.stats[status]
  })
  
  if (versionData) { // Have a release date!
    debug(`...Adding dates to burndown.dates to reach ${versionReleaseDate}`)
    const origBurndownDates = Array.from(burndown.dates)
    // Extend the dates to the release date
    burndown.dates = extendDates(burndown.dates, versionReleaseDate)
    const datesAdded = burndown.dates.length - origBurndownDates.length
    
    debug(`burndown.dates: added ${datesAdded} new entries`)
    jsrCLM.setCategories(burndown.dates)

    let lastTotalEstimate = 0
    Object.keys(data).forEach((status) => {
      lastTotalEstimate += 1 * (data[status][data[status].length - 1])
    })
    debug(`lastTotalEstimate: ${lastTotalEstimate}`)

    data['Forecast'] = Array(burndown.dates.length)

    // Count # of working days between today and release date
    let workdaySpan = 0
    let lastActualDay = new Date(origBurndownDates[origBurndownDates.length - 1])
    lastActualDay.setHours(0,0,0,0)
    
    let lastForecastDay = new Date(burndown.dates[burndown.dates.length - 1])
    lastForecastDay.setHours(0,0,0,0)
    
    let loc = origBurndownDates.length
    while (lastActualDay < lastForecastDay) {
      // data['Forecast'][loc] = lastTotalEstimate - (5 * (loc - origBurndownDates.length))
      if (lastActualDay.getDay() > 0 && lastActualDay.getDay() < 6) { // Weekday
        workdaySpan++
        // debug(`increasing workdaySpan to ${workdaySpan}`)
      }
      lastActualDay.setDate(lastActualDay.getDate() + 1)
    }
    const burndownRate = Math.ceil(lastTotalEstimate/workdaySpan)
    let currEstimate = lastTotalEstimate
    
    lastActualDay = new Date(burndown.dates[origBurndownDates.length])
    lastActualDay.setHours(0,0,0,0)
    lastActualDay.setDate(lastActualDay.getDate() + 1)
    
    // Set the forecast value
    for (let loc = origBurndownDates.length; loc <= burndown.dates.length; loc++) {
      // lastActualDay.setDate(burndown.dates[loc])
      // lastActualDay.setHours(0,0,0,0)

      // debug(`setting forecast on ${burndown.dates[loc]} (lastActualDay: ${lastActualDay}) to ${currEstimate}`)
      data['Forecast'][loc] = Math.round(currEstimate)
      if (lastActualDay.getDay() > 0 && lastActualDay.getDay() < 6) { // Weekday
        currEstimate -= burndownRate
        if (currEstimate < 0) { currEstimate = 0 }
      }
      lastActualDay.setDate(lastActualDay.getDate() + 1)
    }
    res.write(`<hr>`)
    res.write(`<ul class="list-unstyled">`)
    res.write(`<li><em>Release Date:</em> ${versionReleaseDate}</li>`)
    res.write(`<li><em>Total Working Days:</em> ${workdaySpan} working days</li>`)
    res.write(`<li><em>Last Estimate (Total):</em> ${lastTotalEstimate} days</li>`)
    res.write(`<li><em>Burndown Rate:</em> ${burndownRate} estDays/day</li>`)
    res.write(`</ul>`)
  } else { // No release date, so stop the chart at the end of the actual estimates
    jsrCLM.setCategories(burndown.dates)
  }

  
  jsrCLM
    .setLineChart()
    .setSize({ h: 600, w: 800 })
    .setFill(false)
    .buildChartImgTag(`Burndown: ${release ? (release === 'NONE' ? 'No release set' : release) : 'All' } ${component ? ' (Component: ' + component + ')' : '' }`, data, "stacked-bar", 'days')
    .then((link) => {
      res.write(link)
    })
    .catch((err) => {
      debug(`Error caught in buildChartImgTag() = ${err}`)
      res.write(`<EM>Error</EM>: ${err}`)
    })
    .finally(async () => {
      // Show forecast toggle
      res.write(`<p>`)
      res.write(`<div class="solo-button">`)
      debug(`versionData: ${versionData}; versionReleaseDate: ${versionReleaseDate}; forecast: ${forecast}`)
      if (release) { // Only print the forecast button if a release was selected
        if (forecast) {
          res.write(simpleButton('Disable Forecast', '#', true, false, 'btn-outline-success', false, `document.location.href=window.location.protocol + '//' + window.location.hostname + ':' + window.location.port + window.location.pathname + '?forecast=no'; return false;`))
          // res.write(`<a href="" onClick="document.location.href=window.location.protocol + '//' + window.location.hostname + ':' + window.location.port + window.location.pathname + '?forecast=no'; return false;" type="button" class="btn btn-outline-success">Disable Forecast</a>`)
        } else {
          res.write(simpleButton('Enable Forecast', '#', true, false, false, '', `document.location.href=window.location.protocol + '//' + window.location.hostname + ':' + window.location.port + window.location.pathname + '?forecast=yes'; return false;`))
          // res.write(`<a href="" onClick="" class="btn btn-success">Enable Forecast</a>`)
        }
      }
      // res.write(`</div>`)

      // Show component list
      const componentList = await jdr.getComponentList()
      // res.write(`<p>`)
      // res.write(`<div class="btn-group" role="group" aria-label="Component special filter buttons">`) // start button group
      // All components
      if (component) { // A component filter has been selected; this link is to remove that selection
        res.write(`<a href="" onClick="document.location.href=window.location.protocol + '//' + window.location.hostname + ':' + window.location.port + window.location.pathname + '?forecast=${forecast}'; return false;" type="button" class="btn btn-outline-info">Remove filter</a>`)
      }
      res.write(`</p>`)

      // No component set -- should always be available
      res.write(`<a href="" onClick="document.location.href=window.location.protocol + '//' + window.location.hostname + ':' + window.location.port + window.location.pathname + '?component=NONE&forecast=${forecast}'; return false;" type="button" class="btn btn-outline-warning">Empty Component</a></li>`)
      // res.write(`</div>`) // End no/empty filter button group

      // Individual components
      componentList.forEach((c) => {
        // debug(`component: ${component}; c: ${c}; equal? ${component == c}`)
        if (component != c) {
          res.write(`<a href="" onClick="document.location.href=window.location.protocol + '//' + window.location.hostname + ':' + window.location.port + window.location.pathname + '?component=${c}&forecast=${forecast}'; return false;" type="button" class="btn btn-outline-primary">${c}</a>`)
        } else { // Just print a dead button
          res.write(simpleButton(c, false, false))
          // res.write(`<button type="button" class="btn btn-secondary .disabled" disabled aria-disabled="true">${c}</button>`)
        }
      })
      // res.write(`</div>`) // end button group

      // Or if you prefer a simple unordered list display instead of buttons...
      // res.write('<ul>')
      // res.write(`<li><a href="" onClick="document.location.href=window.location.protocol + '//' + window.location.hostname + ':' + window.location.port + window.location.pathname + '?forecast=${forecast}'; return false;"><em>No component filter</em></a></li>`)
      // res.write(`<li><a href="" onClick="document.location.href=window.location.protocol + '//' + window.location.hostname + ':' + window.location.port + window.location.pathname + '?component=NONE&forecast=${forecast}'; return false;"><em>No component set</em></a></li>`)
      // componentList.forEach((c) => {
      //   res.write(`<li><a href="" onClick="document.location.href=window.location.protocol + '//' + window.location.hostname + ':' + window.location.port + window.location.pathname + '?component=${c}&forecast=${forecast}'; return false;">${c}</a></li>`)
      // })
      // res.write(`</ul>`)

      res.write(buildHtmlFooter())
      res.end()
    })
  return next()
})

/**
 * Extend an array of dates to some future date
 *
 * @param {array} origList Array of dates
 * @param {string} newEndDate New final date
 * 
 * @returns {array} newList Array of dates to new end date
 */
function extendDates(origList, newEndDate) {
  debug(`extendDates called: origList length: `, origList.length, `; origList[origList.length - 1]: `, origList[origList.length - 1], `; newEndDate: `, newEndDate)
  if (newEndDate <= origList[origList.length - 1]) {
    debug(`... newEndDate <= last origList entry. Returning origList`)
    return(origList)
  } else {
    const newList = origList
    let d = new Date(origList[origList.length -1])
    const offset = d.getTimezoneOffset()

    d = new Date(d.getTime() - (offset * 60 * 1000))
    d.setDate(d.getDate() + 2)

    let newEndD = new Date(newEndDate)
    newEndD = new Date(newEndD.getTime() - (offset * 60 * 1000))
    
    newEndD.setHours(0,0,0,0)
    d.setHours(0,0,0,0)

    // debug(`... is newEndD (${newEndD}) >= d (${d})?`)
    while (newEndD >= d) {
      newList.push(d.toISOString().split('T')[0])
      d.setDate(d.getDate() + 1)
      // debug(`...incrementing d ${d}; newEndD > d ? `, (newEndD > d))
    }
    // newList.push("2020-11-30")
    return(newList)
  }
}

server.get('/chart', (req, res, next) => {
  let jsrCLM = jsr.getChartLinkMaker(config).reset()
  let chartTitle = req.params.title ? req.params.title : ''

  debug(JSON.stringify(req.query))
  res.write(buildHtmlHeader('Chart', false))
  const typeFilter = req.query.type || false
  if (typeFilter) {
    res.write(`<H1>${typeFilter}</H1>`)
  } else {
    res.write(`<H1>Status Chart (no filter)</H1>`)
  }

  debug(`typeFilter: ${typeFilter}`)

  // Calc cache key
  const cacheKey = XXH.h32(JSON.stringify(req.query), 0xABCD ).toString()
  debug(`cacheKey: `, cacheKey, ` from ${JSON.stringify(req.query)}`)

  let dates, series, statuses, reZero, reZeroData
  reZero = req.query.rezero ? req.query.rezero : false
  reZeroData = []

  if (!cache.has(cacheKey)) {
    debug(`...chart: creating cache for ${cacheKey}`)
    dates = jdr.getDates()
    // Don't modify the original data
    // let series = JSON.parse(JSON.stringify(jdr.getSeriesData()))
    series = { ...jdr.getSeriesData(typeFilter) }
    statuses = Object.keys(series)
    
    const cacheData = {
      dates: dates,
      series: series,
      statuses: statuses
    }
    cache.set(cacheKey, cacheData)
  } else {
    debug(`...chart: fetching cache for ${cacheKey}`)
    const cacheData = cache.get(cacheKey)
    dates = cacheData.dates
    series = cacheData.series
    statuses = cacheData.statuses
  }

  try {
    jsrCLM.setCategories(dates)

    debug('...in /temp about to go through all statuses')
    if (req.query.rezero) {
      debug(`reset = ${req.query.rezero}`)
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
          jsrCLM.addSeries(s, series[s], true)
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

      .buildChartImgTag(chartTitle, null, "line")
      .then((link) => {
        // debug(`buildChartImgTag returned ${link}`)
        res.write(link)
      })
      .catch((err) => {
        debug(`Error caught in buildChartImgTag() = ${err}`)
        res.write(`<EM>Error</EM>: ${err}`)
      })
      .finally(() => {
        res.write(buildHtmlFooter())
        res.end()
      })
  } catch (err) {
    res.write(`${err}`)
    res.end()
    return next()
  }
})

server.get('/components', async (req, res, next) => {
  res.send(await jdr.getComponentList())
  return next()
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

/**
 * Get the JQL phrase to exclude specified Jira issues by Status
 *
 * @returns JQL phrase to exclude by status(es)
 */
function getStatusExclusionString() {
  if (hasStatusExclusionList()) {
    return(` status not in (${getStatusExclusionList().join(',')})`)
  } else {
    return('')
  }
}

/**
 * Get the Array of Statuses to exclude from status queries
 *
 * @returns Array from excludeFromEstimateQueries config value
 */
function getStatusExclusionList() {
  if (hasStatusExclusionList()) {
    return(config.get('excludeFromEstimateQueries'))
  } else {
    return([])
  }
}

/**
 * Are specific Jira Status values to be excluded from estimate queries?
 * Included in the config file as an array of Status names
 *
 * @returns boolean
 */
function hasStatusExclusionList() {
  return(config.has('excludeFromEstimateQueries'))
}

/**
 * Find all the Stories that do not have estimates (either in the Story or in any children)
 *
 * @param {string} project Name of project to query
 * @returns Object result of JQL query (cached)
 */
async function getProjectStoryEstimates(project = config.get('project')) {
  if (!cache.has(`story-estimates-${project}`)) {
    cache.set(`story-estimates-${project}`, await jsr._genericJiraSearch(`issuetype=story AND project="${project}" ${hasStatusExclusionList() ? ` AND ${getStatusExclusionString()}` : ''}`, 99, ['fixVersions', 'aggregateprogress', 'timeoriginalestimate', 'status', 'assignee']))
  }
  return cache.get(`story-estimates-${project}`)
}

server.get('/unestimated', async (req, res, next) => {
  const projStoryEstimates = await getProjectStoryEstimates(config.get('project'))
  if (req.query && req.query.format == 'html') {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    const header = 'Unestimated Stories'
    res.write(buildHtmlHeader(header, false))
    res.write(buildPageHeader(header))
    res.write(hasStatusExclusionList() ? `<p><em>Excluding</em>: ${getStatusExclusionList().join(',')}</p>` : '')
    /* Compile data for table:
     * results = { <rel_name>: [array_of_Jira_keys...], ... }
     */
    const results = {}
    projStoryEstimates.issues.forEach((issue) => {
      const relName = issue.fields.fixVersions.length ? issue.fields.fixVersions[0].name : 'No-Release'

      // Initialize the object
      if (!Object.keys(results).includes(relName)) {
        results[relName] = { totalCount: 0, unestimated: [] }
      }

      results[relName].totalCount++

      /*
       * Only record the story in the 'unestimated' list if:
       *
       * A) the total aggregate progress field is 0
       *           i.e. Story children have no estimates
       *
       * AND
       *
       * B) the timeoriginalestimate is null
       *           i.e. this Story has no estimate
       *
       * TODO: Include Story if any of the children haven't been estimated
       */
      if ( ( issue.fields.aggregateprogress && issue.fields.aggregateprogress.total === 0)
          && ( issue.fields.timeoriginalestimate == null )
          ) {
        results[relName].unestimated.push(issue.key)
      }
    })
    /* Now print out the table
     * Display the total counts per release, where the count is a link to the Jira project query showing all the Jira issues
     */
    res.write(`
    <table style='width: auto !important;' class='table table-sm'>
    <thead>
      <tr>
        <th>Release</th>
        <th class='text-center'>Unestimated</th>
        <th class='text-center'>Total</th>
        <th class='text-center'>% Unestimated</th>
      </tr>
    </thead>
    <tbody>`)
    
    // Track Story counts
    let runningTotal = 0
    let runningUnEstTotal = 0

    Object.keys(results).forEach((rel) => {
      const release = rel === 'No-Release' ? ' is empty' : `="${rel}"`
      res.write(`
      <tr>
        <td>${rel}</td>
        <td class='text-center'><a href='${config.get('jira.protocol')}://${config.get('jira.host')}/issues/?jql=key%20in%20(${results[rel].unestimated.join(',')})' target='_blank'>${results[rel].unestimated.length}</a></td>
        <td class='text-center'><a href='${config.get('jira.protocol')}://${config.get('jira.host')}/issues/?jql=fixVersion${release}%20AND%20project="${config.get('project')}"%20AND%20issuetype="Story"${hasStatusExclusionList() ? ` AND ${getStatusExclusionString()}` : ""}' target='_blank'>${results[rel].totalCount}</a></td>
        <td class='text-center'>${Math.round((100*results[rel].unestimated.length/results[rel].totalCount))}%</td>
      </tr>`)

      runningTotal += results[rel].totalCount
      runningUnEstTotal += results[rel].unestimated.length
    })

    res.write(`
    <td><em>Total</em></td>
    <td class='text-center'>${runningUnEstTotal}</td>
    <td class='text-center'>${runningTotal}</td>
    <td class='text-center'>${Math.round((100*runningUnEstTotal/runningTotal))}%</td>
    </tbody></table>`)
    res.write(buildHtmlFooter())
    res.end()
  } else {
    res.send(projStoryEstimates)
  }
  return next()
})

server.get('/query', async (req, res, next) => {
  try {
    res.send(await jsr._genericJiraSearch(req.query.jql, 99, ['fixVersions']))
  } catch(err) {
    res.send(`query err: `, err)
  }
  return next()
})

/*
 ************** CACHE-RELATED ENDPOINTS **************
 */

server.get('/cacheJSR', (req, res, next) => {
  res.send(jdr.getCacheObject(false))
  return next()
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

server.get('/rebuild-cacheJSR', async (req, res, next) => {
  const updates = await jdr.reloadCache(jdr.rebuild())
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
