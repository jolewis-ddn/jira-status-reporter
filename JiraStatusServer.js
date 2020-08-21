"use strict";
const debug = require('debug')('jira-status-server')
const restify = require('restify')
const restifyErrors = require('restify-errors')
const corsMiddleware = require('restify-cors-middleware')

const config = require('./config')

const JSR = require('./JiraStatusReporter')
let jsr = new JSR()

const JiraDataReader = require('./JiraDataReader')
let jdr = new JiraDataReader()

const path = require('path');
// const JiraDataCache = require('./JiraDataCache');

const labels = ['Epic','Story', 'Task', 'Sub-task','Bug']
const states = ['Open','Active','Closed','Stopped']
const backgroundColors = ['SeaShell','MediumSeaGreen','CornflowerBlue','Pink']
const backgroundColorStr = "backgroundColor:['".concat(backgroundColors.join("','")).concat("']")

var server = restify.createServer()
server.use(restify.plugins.queryParser())

const cors = corsMiddleware({
    origins: ['*'],
    allowHeaders: [],
    exposeHeaders: []
})

server.use(cors.preflight)
server.use(cors.actual)

server.get('/docs/*', restify.plugins.serveStatic({ directory: './static', default: 'charts.html' }))

function report(req, res, next) {
    Promise.all([
        jsr.countRedEpics(), 
        jsr.countDeadIssues(), 
        jsr.countOpenIssuesByProject('RED'), 
        jsr.countIssuesDoneThisMonth('RED'),
        jsr.getIssuesDoneThisMonth('RED'),
        jsr.countIssuesChangedThisMonthByProjectAndStatus('RED', 'Status'),
        jsr.getIssuesChangedThisWeekByProjectAndStatus('RED', 'Status'),
    ])
    .then((values) => {
        const doneData = values[4].issues
        const doneKeys = []
        doneData.forEach((data) => {
            debug(`doneKeys - adding ${data.key}`)
            doneKeys.push(data.key)
        })

        const statusChangesThisWeek = []
        values[6].issues.forEach((data) => {
            let assigneeName = ""
            if (data.fields.assignee) {
                assigneeName = data.fields.assignee.displayName
            }
            statusChangesThisWeek.push({key: data.key, type: data.fields.issuetype.name, owner: assigneeName, updated: data.fields.updated, status: data.fields.status.name, summary: data.fields.summary })
        })

        res.send({
            'RED Epic Count': values[0], 
            'Dead Issue Count': values[1], 
            'Open Issues (Count)': values[2],
            'Issue Status updates this Month (Count)': values[5],
            'Issue Status updates this Week (Count)': values[5],
            'Issue Status updates this Week (List)': statusChangesThisWeek,
            'Issues Done this Month (Count)': values[3],
            'Issues Done this Month (List)': doneKeys.join(','),
            // 'Issues Done this Month (Data)': values[4],
        })
        return next();
    })
    .catch((err) => {
        return next(new restifyErrors.InternalServerError(err));
    })
}

server.get('/', (req, res, next) => { res.send('ok'); return next(); })

server.get('/report', report)

server.get('/homedir', (req, res, next) => {
    res.send(jsr.getFileManager().getHomeDir())
    return next()
});

server.get('/dates', (req, res, next) => {
    res.send(jdr.getDates())
    return next()
})

server.get('/series', (req, res, next) => {
    res.send(jdr.getSeriesData())
    return next()
})

function formatCssClassName(jiraName) {
    return(jiraName.replace(/\s/g, ''))
}

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
        case typeof "":
            debug(`string - splitting...`)
            let epicList = []
            if (epicIds.indexOf(",") > 0) {
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
    return(promises)
}

function buildLegend() {
    let legendStr = "<div class='sticky legend'>"
    backgroundColors.forEach((c, ndx) => {
        legendStr += `<span style="background-color: ${c}; padding: 4px; border: 6px; border-color: ${c}; margin: 5px; border-style: solid; border-radius: 8px; z-index: 999;">${states[ndx]}</span>`
    })
    legendStr += "</div>"
    return(legendStr)
}

function buildHtmlHeader(title = "", showButtons = true) {
    // Bootstrap 5 alpha
    // return(`<!doctype html><html lang="en"><head><title>${title}</title><meta charset="utf-8"><link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/5.0.0-alpha1/css/bootstrap.min.css" integrity="sha384-r4NyP46KrjDleawBgD5tp8Y7UzmLA05oM1iAEQ17CSuDqnUK2+k9luXQOfXJCJ4I" crossorigin="anonymous">${buildStylesheet()}</head>`)

    let buttons = `<button id='toggleCharts' type='button' class='btn btn-outline-primary btn-sm float-right'>Toggle Charts</button>
    <button id='toggleButton' type='button' class='btn btn-outline-primary btn-sm float-right'>Toggle Names</button>
    <button id='toggleLegend' type='button' class='btn btn-outline-primary btn-sm float-right'>Toggle Legend</button>`

    if (!showButtons) { buttons = `` }

    // Bootstrap 4.5
    return(`<!doctype html><html lang="en"><head><title>${title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
        <!-- Bootstrap CSS -->
        <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" integrity="sha384-JcKb8q3iqJ61gNV9KGb8thSsNjpSL0n8PARn9HuZOnIxN0hoP+VmmDGMN5t9UJ0Z" crossorigin="anonymous">
        <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js" integrity="sha384-DfXdz2htPH0lsSSs5nCTpuj/zy4C+OGpamoFVy38MVBnE+IbbVYUew+OrCXaRkfj" crossorigin="anonymous"></script>
        ${buildStylesheet()}
        ${buildButtonJs()}
        </head>
        <body>
        ${buttons}
        `)
}

function buildPageHeader(h, h2 = "") {
    return(`<h1>${h}</h1><h2>${h2}</h2>`)
}

function buildStylesheet() {
    return(`<style>
    .children { padding-left: 20px; }
    .icon { padding: 4px; margin: -2px 4px -2px 4px; }
    .Icebox, .New, .Open { background-color: white; }
    .InProgress { background-color: green; }
    .InReview { background-color: lightgreen; }
    .Done, .CLOSED { background-color: blue; }
    .Dead { background-color: black; }
    .Emergency { background-color: pink; }
    .Blocked { background-color: pink; }
    .link { text-decoration: none; }
    .legend { position: sticky; right: 0; bottom: 0; z-index: -1; }
    .issueComboLink { display: grid; }
    .issueName { display: inline; }
    </style>`)
}

function buildButtonJs() {
    return(`<script>
    let showNames = true;
    let showCharts = true;
    let showLegend = true;
    const tog = function() { console.log('in tog') }
    $(document).ready(function(){
        $('#toggleButton').click(function(){
            if (showNames) {
                $('.issueName').css('display', 'none');
                $('.issueComboLink').css({'display': 'inline', 'margin':'-4px' });
            } else {
                $('.issueName').css('display', 'inline');
                $('.issueComboLink').css({ 'display': 'grid', 'margin':'0px' });
            }
            showNames = !showNames;
        });
        $('#toggleCharts').click(function(){
            (showCharts) ? $('.pieCharts').css('display', 'none') : $('.pieCharts').css('display', 'contents');
            showCharts = !showCharts;
        });
        $('#toggleLegend').click(function(){
            (showLegend) ? $('.legend').css('display', 'none') : $('.legend').css('display', 'block');
            showLegend = !showLegend;
        })
    });
    </script>`)
}

function buildHtmlFooter() {
    // Bootstrap 5 alpha
    // return(`<script src="https://cdn.jsdelivr.net/npm/popper.js@1.16.0/dist/umd/popper.min.js" integrity="sha384-Q6E9RHvbIyZFJoft+2mJbHaEWldlvI9IOYy5n3zV9zzTtmI3UksdQRVvoxMfooAo" crossorigin="anonymous"></script>

    // Bootstrap 4.5
    return(`<script src="https://cdn.jsdelivr.net/npm/popper.js@1.16.1/dist/umd/popper.min.js" integrity="sha384-9/reFTGAW83EW2RDu2S0VKaIzap3H66lZH81PoYlFhbGU+6BZp6G7niu735Sk7lN" crossorigin="anonymous"></script>
        <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js" integrity="sha384-B4gt1jrGC7Jh4AgTPSdUtOBvfO8shuf57BaghqFfPlYxofvL8/KUEfYiJOMMV+rV" crossorigin="anonymous"></script>`)
}

/**
 *Create HTML for pie charts
 *
 * @param {*} stats
 */
function buildPieCharts(stats) {
    const w = 120
    const h = w

    debug(`buildPieCharts() called`)
    debug(stats)
    let results = []

    results.push("<span id='pieCharts' class='pieCharts'>")

    // Charts...
    labels.forEach((i, ndx) => {
        debug(`labels forEach => ${i} @ ${ndx} = `, stats[i])
        let linktext = `<!-- ${i} --><img src="${config().graphicServer.protocol}://${config().graphicServer.server}:${config().graphicServer.port}/${config().graphicServer.script}?width=${w}&height=${h}&c={type:%27pie%27,data:{labels:['${states.join("','")}'],datasets:[{data:[${stats[i]['Open']},${stats[i]['Active']},${stats[i]['Closed']},${stats[i]['Stopped']}],` + backgroundColorStr + `}]},options:{title:{display:true,text:'${cleanText(i)}',fontSize:18},legend:{display:false,position:'bottom'}}}"/>`
        debug(linktext)
        results.push(linktext)
    })
    results.push("</span>")

    return(results.join(''))
}

// Clean out " from string - for use with Title attribute values
function cleanText(t) {
    let newText = t
    newText = newText.replace(/'/g, '&apos;')
    newText = newText.replace(/"/g, '&quot;')
    newText = newText.replace(/>/g, '&#062;')
    newText = newText.replace(/</g, '&#060;')
    return(newText)
}

function updateStats(stats, issueType, issueStatusName) {
    let newStats = stats
    debug(`updateStats(stats, ${issueType}, ${issueStatusName}) called...`)
    switch (issueStatusName) {
        case "Icebox":
        case "Defined":
        case "New":
        case "Open":
            newStats[issueType]['Open'] += 1
            break
        case "In Progress":
        case "In Review":
            debug(`In Progress or In Review.`)
            newStats[issueType]['Active'] += 1
            break
        case "Done":
        case "CLOSED":
        case "Dead":
            newStats[issueType]['Closed'] += 1
            break
        case "Emergency":
        case "Blocked":
            newStats[issueType]['Stopped'] += 1
            break
    }
    return(newStats)
}

server.get('/bogus', (req, res, next) => {
    jsr.createBogusLink()
    res.send('ok')
    return next()
})

function buildLink(issueKey, statusName, issueTypeIconUrl, issueSummary, issueOwner, issueStatus) {
    const title = `${issueKey}: ${issueSummary} (${issueOwner}; ${issueStatus})`
    return(`<span class='issueComboLink'><a href='${config().jira.protocol}://${config().jira.host}/browse/${issueKey}' target='_blank'><img class='icon ${formatCssClassName(statusName)}' src='${issueTypeIconUrl}' title='${cleanText(title)}')/><span class='issueName'/>${title}</span></a></span>`)
}

server.get('/fields', (req, res, next) => {
    debug('/fields called...')
    jsr.get('field')
    .then((data) => {
        debug(req.query)
        if (req.query && req.query.format == "html") {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.write(buildHtmlHeader("Field List", false))
            res.write(`<H1>Field List</H1><p><sm>${config().jira.host}</sm></p>`)
            res.write(`<table style="width: auto;" class="table table-striped table-hover table-sm"><thead class="thead-dark"><tr><th scope="col">${['ID', 'Name', 'Custom', 'Navigable', 'Searchable', 'Clause Names'].join('</th><th scope="col">')}</th></tr></thead><tbody>`)
            data.forEach((d) => {
                res.write(`<tr><th scope="row">${d.id}</th><td>${[d.name, d.custom, d.navigable, d.searchable, d.clauseNames.join('<br>')].join('</td><td>')}</td></tr>`)
            })
            res.write(`</tbody></table>`)
            res.write(buildHtmlFooter())
        } else {
            res.send(data)
        }
        return next()
    })
})

server.get('/filter', (req, res, next) => {
    debug('/filter called...')
    jsr.getFilter(req.query.id)
    .then((data) => {
        debug(`getFilter returned...`)
        
        const newHeader = `${data.name}: Filter #${req.query.id}`
        res.write(buildHtmlHeader(newHeader))
        res.write(buildPageHeader(data.name, `Filter: ${req.query.id}`))
        jsr._genericJiraSearch(data.jql, 99)
        .then((e) => {
            let stats = { 
                Epic: { Open: 0, Active: 0, Closed: 0, Stopped: 0 },
                Story: { Open: 0, Active: 0, Closed: 0, Stopped: 0 },
                Task: { Open: 0, Active: 0, Closed: 0, Stopped: 0 },
                'Sub-task': { Open: 0, Active: 0, Closed: 0, Stopped: 0 },
                Bug: { Open: 0, Active: 0, Closed: 0, Stopped: 0 },
            }

            let results = { Epics: [], Stories: [], Tasks: [], Bugs: [], 'Sub-tasks': [] }
            let contents = []

            for (let x = 0; x < e.issues.length; x++) {
                let issue = e.issues[x]
                let ndx = x

                let owner = "TBD"
                try {
                    owner = issue.fields.assignee.displayName
                } catch (err) {
                    owner = "unassigned"
                }

                let statusName = "unknown"
                try {
                    statusName = issue.fields.status.name
                } catch (err) {
                    statusName = "unknown"
                }

                switch (issue.fields.issuetype.name) {
                    case "Epic":
                        results.Epics.push(buildLink(issue.key, issue.fields.status.name, issue.fields.issuetype.iconUrl, issue.fields.summary, owner, statusName))
                        debug(`Sub-task ${issue.key}...`)
                        stats = updateStats(stats, 'Epic', statusName)
                        break
                    case "Sub-task":
                        results['Sub-tasks'].push(buildLink(issue.key, issue.fields.status.name, issue.fields.issuetype.iconUrl, issue.fields.summary, owner, statusName))
                        debug(`Sub-task ${issue.key}...`)
                        stats = updateStats(stats, 'Sub-task', statusName)
                        break
                    case "Task":
                        results.Tasks.push(buildLink(issue.key, issue.fields.status.name, issue.fields.issuetype.iconUrl, issue.fields.summary, owner, statusName))
                        debug(`Task ${issue.key}...`)
                        stats = updateStats(stats, 'Task', statusName)
                        break
                    case "Story":
                        debug(`...adding Story ${issue.key} to results.Stories (increasing size (was ${results.Stories.length}) by 1)`)
                        results.Stories.push(buildLink(issue.key, issue.fields.status.name, issue.fields.issuetype.iconUrl, issue.fields.summary, owner, statusName))
                        debug(`Story ${issue.key}...`)
                        stats = updateStats(stats, 'Story', statusName)
                        break
                    case "Bug":
                        results.Bugs.push(buildLink(issue.key, issue.fields.status.name, issue.fields.issuetype.iconUrl, issue.fields.summary, owner, statusName))
                        debug(`Bug ${issue.key}...`)
                        stats = updateStats(stats, 'Bug', statusName)
                        break
                    default:
                        debug(`ERR ****** unrecognized issuetype: ${issue.fields.issuetype.name}`)
                }
            }

            debug(`stats: `, stats)

            // charts
            res.write(buildPieCharts(stats))
            
            // icons
            res.write('<hr><div class="children">' + results.Epics.join('') +  results.Stories.join('') + results.Tasks.join('') + results['Sub-tasks'].join('') + results.Bugs.join('') + '</div>')
            res.write('</div>')
            res.write('<hr>')
            res.write(buildLegend())
            res.write(buildHtmlFooter())
            res.end()
            return next()
        })
        .catch((err) => {
            debug(`error in generic search: ${err}`)
            res.end()
            return
        })
    })
    .catch((err) => {
        debug(`getFilter error...`)
        debug(err)
        res.write(buildHtmlHeader(`Filter: ${req.query.id}`))
        res.write(`<em>Error</em> ${err}`)
        res.end()
        return
    })
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
            'Epic': { Open: 0, Active: 0, Closed: 0, Stopped: 0 },
            'Story': { Open: 0, Active: 0, Closed: 0, Stopped: 0 },
            'Task': { Open: 0, Active: 0, Closed: 0, Stopped: 0 },
            'Sub-task': { Open: 0, Active: 0, Closed: 0, Stopped: 0 },
            'Bug': { Open: 0, Active: 0, Closed: 0, Stopped: 0 },
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

            let owner = "TBD"
            try {
                owner = epicData.fields.assignee.displayName
            } catch (err) {
                owner = "unassigned"
            }

            let statusName = "unknown"
            try {
                statusName = epicData.fields.status.name
            } catch (err) {
                debug(`... unrecognized status for ${epicData.key}!`)
                statusName = "unknown"
            }

            let resultCtr = { 
                'Epics': [], 
                'Stories': [], 
                'Tasks': [],
                'Sub-tasks': [],
                'Bugs': [] 
            }

            details.push(`<li class="list-group-item d-flex justify-content-between align-items" style="align-self: start;">`)
            details.push(`<a href='${config().jira.protocol}://${config().jira.host}/browse/${epicData.key}' target='_blank'><img class='icon ${formatCssClassName(statusName)}' src='${epicData.fields.issuetype.iconUrl}' title='${cleanText(epicData.key)}: ${cleanText(epicData.fields.summary)} (${owner}; ${statusName})'/></a>`)
            details.push(`${epicData.key}: ${epicData.fields.summary}`)
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
                let owner = "TBD"
                try {
                    owner = issue.fields.assignee.displayName
                } catch (err) {
                    owner = "unassigned"
                }

                let statusName = "unknown"
                try {
                    statusName = issue.fields.status.name
                } catch (err) {
                    statusName = "unknown"
                }

                switch (issue.fields.issuetype.name) {
                    case "Epic":
                        resultCtr['Epics'].push(`<a href='${config().jira.protocol}://${config().jira.host}/browse/${issue.key}' target='_blank'><img class='icon ${formatCssClassName(issue.fields.status.name)}' src='${issue.fields.issuetype.iconUrl}' title='${cleanText(issue.key)}: ${cleanText(issue.fields.summary)} (${owner}; ${statusName})'/></a>`)
                        debug(`Epic ${issue.key}...`)
                        stats = updateStats(stats, 'Epic', statusName)
                        break
                    case "Story":
                        resultCtr['Stories'].push(`<a href='${config().jira.protocol}://${config().jira.host}/browse/${issue.key}' target='_blank'><img class='icon ${formatCssClassName(issue.fields.status.name)}' src='${issue.fields.issuetype.iconUrl}' title='${cleanText(issue.key)}: ${cleanText(issue.fields.summary)} (${owner}; ${statusName})'/></a>`)
                        debug(`Story ${issue.key}...`)
                        stats = updateStats(stats, 'Story', statusName)
                        break
                    case "Task":
                        resultCtr['Tasks'].push(`<a href='${config().jira.protocol}://${config().jira.host}/browse/${issue.key}' target='_blank'><img class='icon ${formatCssClassName(issue.fields.status.name)}' src='${issue.fields.issuetype.iconUrl}' title='${cleanText(issue.key)}: ${cleanText(issue.fields.summary)} (${owner}; ${statusName})'/></a>`)
                        debug(`Task ${issue.key}...`)
                        stats = updateStats(stats, 'Task', statusName)
                        break
                    case "Sub-task":
                        resultCtr['Sub-tasks'].push(`<a href='${config().jira.protocol}://${config().jira.host}/browse/${issue.key}' target='_blank'><img class='icon ${formatCssClassName(issue.fields.status.name)}' src='${issue.fields.issuetype.iconUrl}' title='${cleanText(issue.key)}: ${cleanText(issue.fields.summary)} (${owner}; ${statusName})'/></a>`)
                        debug(`Sub-task ${issue.key}...`)
                        stats = updateStats(stats, 'Sub-task', statusName)
                        break
                    case "Bug":
                        resultCtr['Bugs'].push(`<a href='${config().jira.protocol}://${config().jira.host}/browse/${issue.key}' target='_blank'><img class='icon ${formatCssClassName(issue.fields.status.name)}' src='${issue.fields.issuetype.iconUrl}' title='${cleanText(issue.key)}: ${cleanText(issue.fields.summary)} (${owner}; ${statusName})'/></a>`)
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
                <span class="badge bg-dark rounded-pill">
                    ${resultCtr['Epics'].length}
                </span>
                <span class="badge bg-dark rounded-pill">
                    ${resultCtr['Stories'].length}
                </span>
                <span class="badge bg-dark rounded-pill">
                    ${resultCtr['Tasks'].length}
                </span>
                <span class="badge bg-dark rounded-pill">
                    ${resultCtr['Sub-tasks'].length}
                </span>
                <span class="badge bg-dark rounded-pill">
                    ${resultCtr['Bugs'].length}
                </span></div>`)
            details.push(`</li>`)
        })
        details.push(`</ul>`)

        debug(`buildPieCharts() called with ${stats}`)

        res.write(buildPieCharts(stats))
        res.write('<hr>')
        res.write(buildLegend())
        res.write('<hr>')
        res.write(details.join(''))
        res.write(buildHtmlFooter())
        res.end()
        return next()
})
    .catch((err) => {
        debug(`error`)
        debug(err)
        res.write("error")
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
    let series = {...jdr.getSeriesData(typeFilter)}
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
                    series[s] = series[s].map(x => x - reZeroData[s])
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

        jsrCLM.setLineChart()
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

server.get('/cache', (req, res, next) => {
    res.send(jdr.getCacheObject(false))
    return
})

server.get('/reread-cache', (req, res, next) => {
    res.send(`reread`)
    return next()
})

server.get('/refresh-cache', (req, res, next) => {
    const updates = jdr.reloadCache(jdr.refresh())
    res.send(`refreshed ${updates}`)
    return next()
})

server.get('/rebuild-cache', (req, res, next) => {
    const updates = jdr.reloadCache(jdr.rebuild())
    res.send(`rebuilt ${updates}`)
    return next()
})

server.get('/reset', (req, res, next) => {
    jsr = new JSR()
    jdr = new JiraDataReader()
    res.redirect('/chart', next)
    return
})

server.get('/wipe-cache', (req, res, next) => {
    jdr.getCacheObject().wipe(true)
    res.send(`wiped`)
    return next()
})

server.get('/datafiles', (req, res, next) => {
    try {
        let summary = jdr.getDataSummary()
        res.send(summary)
    } catch (err) {
        res.send(500, err)
    }
    return next()
})

server.listen(config().server.port, function() {
    console.log('%s listening at %s', server.name, server.url);
});
