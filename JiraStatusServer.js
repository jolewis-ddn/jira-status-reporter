"use strict";
const debug = require('debug')('jira-status-server')
const restify = require('restify')
const restifyErrors = require('restify-errors')
const corsMiddleware = require('restify-cors-middleware')

const JSR = require('./JiraStatusReporter')
let jsr = new JSR()

const JiraDataReader = require('./JiraDataReader')
let jdr = new JiraDataReader()

const config = require('./config')

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
    return(jiraName.replace(/\s/g, '-'))
}

function cleanTitle(title) {
    return(title.replace(/'/g, '&apos;'))
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

function buildHtmlHeader(title = "") {
    return(`<!doctype html><html lang="en"><head><title>${title}</title><meta charset="utf-8"><link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/5.0.0-alpha1/css/bootstrap.min.css" integrity="sha384-r4NyP46KrjDleawBgD5tp8Y7UzmLA05oM1iAEQ17CSuDqnUK2+k9luXQOfXJCJ4I" crossorigin="anonymous">`)
}

function buildPageHeader(h, h2 = "") {
    return(`<h1>${h}</h1><h2>${h2}</h2>`)
}

function buildHtmlFooter() {
    return(`<script src="https://cdn.jsdelivr.net/npm/popper.js@1.16.0/dist/umd/popper.min.js" integrity="sha384-Q6E9RHvbIyZFJoft+2mJbHaEWldlvI9IOYy5n3zV9zzTtmI3UksdQRVvoxMfooAo" crossorigin="anonymous"></script>
    <script src="https://stackpath.bootstrapcdn.com/bootstrap/5.0.0-alpha1/js/bootstrap.min.js" integrity="sha384-oesi62hOLfzrys4LxRF63OJCXdXDipiYWBnvTl9Y9/TRlw5xlKIEHpNyvvDShgf/" crossorigin="anonymous"></script>`)
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

    // Charts...
    labels.forEach((i, ndx) => {
        debug(`labels forEach => ${i} @ ${ndx} = `, stats[i])
        let linktext = `<!-- ${i} --><img src="${config.graphicServer.protocol}://${config.graphicServer.server}:${config.graphicServer.port}/${config.graphicServer.script}?width=${w}&height=${h}&c={type:%27pie%27,data:{labels:['${states.join("','")}'],datasets:[{data:[${stats[i]['Open']},${stats[i]['Active']},${stats[i]['Closed']},${stats[i]['Stopped']}],` + backgroundColorStr + `}]},options:{title:{display:true,text:'${i}',fontSize:18},legend:{display:false,position:'bottom'}}}"/>`
        debug(linktext)
        results.push(linktext)
    })
    return(results.join(''))
}

function updateStats(stats, issueType, issueStatusName) {
    let newStats = stats
    switch (issueStatusName) {
        case "Icebox":
        case "Defined":
            newStats[issueType]['Open'] += 1
            break
        case "In Progress":
        case "In Review":
            newStats[issueType]['Active'] += 1
            break
        case "Done":
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

server.get('/filter', (req, res, next) => {
    jsr.getFilter(req.query.id)
    .then((data) => {
        debug(`getFilter returned...`)
        debug(data)
        res.write(buildHtmlHeader(`Filter: ${req.query.id}`))
        res.write(buildPageHeader(data.name))
        jsr._genericJiraSearch(data.jql, 99)
        .then((e) => {
            let stats = { 
                Epic: { Open: 0, Active: 0, Closed: 0, Stopped: 0 },
                Story: { Open: 0, Active: 0, Closed: 0, Stopped: 0 },
                Task: { Open: 0, Active: 0, Closed: 0, Stopped: 0 },
                'Sub-task': { Open: 0, Active: 0, Closed: 0, Stopped: 0 },
                Bug: { Open: 0, Active: 0, Closed: 0, Stopped: 0 },
            }
        
            // Write stylesheet
            res.write(buildStylesheet(res))
            // Process data

            let results = { Epics: [], Stories: [], Tasks: [], Bugs: [], 'Sub-tasks': [] }

            let contents = []

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
                        results.Epics.push(`<a href='${config.jira.protocol}://${config.jira.host}/browse/${issue.key}' target='_blank'><img class='icon ${formatCssClassName(issue.fields.status.name)}' src='${issue.fields.issuetype.iconUrl}' title='${issue.key}: ${issue.fields.summary} (${owner}; ${statusName})')/></a>`)
                        debug(`Sub-task ${issue.key}...`)
                        stats = updateStats(stats, 'Epic', statusName)
                        break
                    case "Sub-task":
                        results['Sub-tasks'].push(`<a href='${config.jira.protocol}://${config.jira.host}/browse/${issue.key}' target='_blank'><img class='icon ${formatCssClassName(issue.fields.status.name)}' src='${issue.fields.issuetype.iconUrl}' title='${issue.key}: ${issue.fields.summary} (${owner}; ${statusName})')/></a>`)
                        debug(`Sub-task ${issue.key}...`)
                        stats = updateStats(stats, 'Sub-task', statusName)
                        break
                    case "Task":
                        results.Tasks.push(`<a href='${config.jira.protocol}://${config.jira.host}/browse/${issue.key}' target='_blank'><img class='icon ${formatCssClassName(issue.fields.status.name)}' src='${issue.fields.issuetype.iconUrl}' title='${issue.key}: ${issue.fields.summary} (${owner}; ${statusName})')/></a>`)
                        debug(`Task ${issue.key}...`)
                        stats = updateStats(stats, 'Task', statusName)
                        break
                    case "Story":
                        results.Stories.push(`<a href='${config.jira.protocol}://${config.jira.host}/browse/${issue.key}' target='_blank'><img class='icon ${formatCssClassName(issue.fields.status.name)}' src='${issue.fields.issuetype.iconUrl}' title='${issue.key}: ${issue.fields.summary} (${owner}; ${statusName})')/></a>`)
                        debug(`Story ${issue.key}...`)
                        stats = updateStats(stats, 'Story', statusName)
                        break
                    case "Bug":
                        results.Bugs.push(`<a href='${config.jira.protocol}://${config.jira.host}/browse/${issue.key}' target='_blank'><img class='icon ${formatCssClassName(issue.fields.status.name)}' src='${issue.fields.issuetype.iconUrl}' title='${issue.key}: ${issue.fields.summary} (${owner}; ${statusName})')/></a>`)
                        debug(`Bug ${issue.key}...`)
                        stats = updateStats(stats, 'Bug', statusName)
                        break
                    default:
                        debug(`unrecognized issuetype: ${issue.fields.issuetype.name}`)
                }
            })
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
        debug(`getFilter errored out...`)
        debug(err)
        res.send(err)
        res.end()
        return
    })
})

function buildStylesheet() {
    return(`<style>
    .children { padding-left: 20px; }
    .icon { spacing: 0px; padding: 4px; }
    .Icebox { background-color: white; }
    .In-Progress { background-color: green; }
    .In-Review { background-color: lightgreen; }
    .Done { background-color: blue; }
    .Dead { background-color: black; }
    .Emergency { background-color: red; }
    .Blocked { background-color: red; }
    .link { text-decoration: none; }
    .legend { position: sticky; right: 0; bottom: 0; z-index: -1; }
    </style>`)
}

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
            details.push(`<a href='${config.jira.protocol}://${config.jira.host}/browse/${epicData.key}' target='_blank'><img class='icon ${formatCssClassName(statusName)}' src='${epicData.fields.issuetype.iconUrl}' title='${cleanTitle(epicData.key)}: ${cleanTitle(epicData.fields.summary)} (${owner}; ${statusName})'/></a>`)
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
                        resultCtr['Epics'].push(`<a href='${config.jira.protocol}://${config.jira.host}/browse/${issue.key}' target='_blank'><img class='icon ${formatCssClassName(issue.fields.status.name)}' src='${issue.fields.issuetype.iconUrl}' title='${cleanTitle(issue.key)}: ${cleanTitle(issue.fields.summary)} (${owner}; ${statusName})'/></a>`)
                        debug(`Epic ${issue.key}...`)
                        stats = updateStats(stats, 'Epic', statusName)
                        break
                    case "Story":
                        resultCtr['Stories'].push(`<a href='${config.jira.protocol}://${config.jira.host}/browse/${issue.key}' target='_blank'><img class='icon ${formatCssClassName(issue.fields.status.name)}' src='${issue.fields.issuetype.iconUrl}' title='${cleanTitle(issue.key)}: ${cleanTitle(issue.fields.summary)} (${owner}; ${statusName})'/></a>`)
                        debug(`Story ${issue.key}...`)
                        stats = updateStats(stats, 'Story', statusName)
                        break
                    case "Task":
                        resultCtr['Tasks'].push(`<a href='${config.jira.protocol}://${config.jira.host}/browse/${issue.key}' target='_blank'><img class='icon ${formatCssClassName(issue.fields.status.name)}' src='${issue.fields.issuetype.iconUrl}' title='${cleanTitle(issue.key)}: ${cleanTitle(issue.fields.summary)} (${owner}; ${statusName})'/></a>`)
                        debug(`Task ${issue.key}...`)
                        stats = updateStats(stats, 'Task', statusName)
                        break
                    case "Sub-task":
                        resultCtr['Sub-tasks'].push(`<a href='${config.jira.protocol}://${config.jira.host}/browse/${issue.key}' target='_blank'><img class='icon ${formatCssClassName(issue.fields.status.name)}' src='${issue.fields.issuetype.iconUrl}' title='${cleanTitle(issue.key)}: ${cleanTitle(issue.fields.summary)} (${owner}; ${statusName})'/></a>`)
                        debug(`Sub-task ${issue.key}...`)
                        stats = updateStats(stats, 'Sub-task', statusName)
                        break
                    case "Bug":
                        resultCtr['Bugs'].push(`<a href='${config.jira.protocol}://${config.jira.host}/browse/${issue.key}' target='_blank'><img class='icon ${formatCssClassName(issue.fields.status.name)}' src='${issue.fields.issuetype.iconUrl}' title='${cleanTitle(issue.key)}: ${cleanTitle(issue.fields.summary)} (${owner}; ${statusName})'/></a>`)
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
    let jsrCLM = jsr.getChartLinkMaker().reset()
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

server.listen(config.server.port, function() {
    console.log('%s listening at %s', server.name, server.url);
});
