"use strict";
const debug = require('debug')('simple-server')
const restify = require('restify')
const restifyErrors = require('restify-errors')

const JSR = require('./JiraStatusReporter')
let jsr = new JSR()

const JiraDataReader = require('./JiraDataReader')
let jdr = new JiraDataReader()

const config = require('./config.js')

const path = require('path');

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

var server = restify.createServer()
server.use(restify.plugins.queryParser())

// **************** 

server.get('/', report)

server.get('/dir', (req, res, next) => {
    res.send(jsr.getFileManager().getHomeDir())
    return next()
});

server.get('/sampleImg', (req, res, next) => {
    let jsrCLM = jsr.getChartLinkMaker().reset()

    try {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        jsrCLM.setCategories(['January','February','March','April', 'May'])
        jsrCLM.addSeries("dogsY", [50,60,70,180,190])
            .addSeries("catsX", [100,200,300,400,500])
            .addSeries("zebras", [130,150,130,40,50])
            // .addSeries("goats", [30,50,30,10,5])
            .setBarChart()
            // .setLineChart()
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
        res.write(`<EM>Error</EM>: ${err}`)
        res.end()
        return next()
    }
})

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

server.get('/epics', (req, res, next) => {
    let epicIds = req.query.id
    let promises = []
    switch (typeof epicIds) {
        case typeof {}:
            epicIds.forEach((id, ndx) => {
                debug(`pushing ${id}...`)
                promises.push(jsr.getEpicAndChildren(id))
            })
            break
        case typeof []:
            epicIds.forEach((id, ndx) => {
                debug(`pushing ${id}...`)
                promises.push(jsr.getEpicAndChildren(id))
            })
            break
        case typeof "":
            let epicList = []
            if (epicIds.indexOf(",") > 0) {
                epicList = epicIds.split(',')
                epicList.push()
            }
            epicList.forEach((id, ndx) => {
                debug(`pushing ${id}...`)
                promises.push(jsr.getEpicAndChildren(id))
            })
            break
        default:
            debug(`unknown typeof epicIds: ${typeof epicIds}`)
    }

    Promise.all(promises)
    .then((results) => {
        res.write("<style>\n")
        res.write(".children { padding-left: 20px; }")
        res.write(".icon { spacing: 0px; padding: 2px; }")
        res.write(".Icebox { background-color: white; }")
        res.write(".In-Progress { background-color: green; }")
        res.write(".In-Review { background-color: lightgreen; }")
        res.write(".Done { background-color: blue; }")
        res.write(".Dead { background-color: black; }")
        res.write(".Emergency { background-color: red; }")
        res.write(".Blocked { background-color: red; }")
        res.write(".link { text-decoration: none; }")
        res.write("</style>")

        results.forEach((e) => {
            // for getEpicAndChildren(x), the Epic is always the last Issue in the issues list
            let epicData = e.issues.pop()
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
        
            res.write(`<div><a href='https://ime-ddn.atlassian.net/browse/${epicData.key}' target='_blank'><img class='icon ${formatCssClassName(statusName)}' src='${epicData.fields.issuetype.iconUrl}' title='${epicData.key}: ${epicData.fields.summary} (${owner}; ${statusName})')/></a>`)
            res.write(`${epicData.key}: ${epicData.fields.summary}`)

            // Process children
            let results = { epic: [], stories: [], bugs: [], subtasks: [] }
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
                    case "Sub-task":
                        results.subtasks.push(`<a href='https://ime-ddn.atlassian.net/browse/${issue.key}' target='_blank'><img class='icon ${formatCssClassName(issue.fields.status.name)}' src='${issue.fields.issuetype.iconUrl}' title='${issue.key}: ${issue.fields.summary} (${owner}; ${statusName})')/></a>`)
                        debug(`Sub-task ${issue.key}...`)
                        break
                    case "Story":
                        results.stories.push(`<a href='https://ime-ddn.atlassian.net/browse/${issue.key}' target='_blank'><img class='icon ${formatCssClassName(issue.fields.status.name)}' src='${issue.fields.issuetype.iconUrl}' title='${issue.key}: ${issue.fields.summary} (${owner}; ${statusName})')/></a>`)
                        debug(`Story ${issue.key}...`)
                        break
                    case "Bugs":
                        results.bugs.push(`<a href='https://ime-ddn.atlassian.net/browse/${issue.key}' target='_blank'><img class='icon ${formatCssClassName(issue.fields.status.name)}' src='${issue.fields.issuetype.iconUrl}' title='${issue.key}: ${issue.fields.summary} (${owner}; ${statusName})')/></a>`)
                        debug(`Bug ${issue.key}...`)
                        break
                    default:
                        debug(`unrecognized issuetype: ${issue.fields.issuetype.name}`)
                }
            })
            res.write('<div class="children">' + results.stories.join('') + results.subtasks.join('') + results.bugs.join('') + '</div>')
            res.write('</div>')
        })
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

server.get('/epic-old', (req, res, next) => {
    if (req.query.id) {
        debug(typeof req.query.id)
        debug(`/epic called: ${req.query.id}`)
        // let epicIds = req.query.id
        req.query.id.forEach((epicId) => {

            res.write("<style>\n")
            res.write(".Icebox { background-color: white; }")
            res.write(".In-Progress { background-color: green; }")
            res.write(".In-Review { background-color: lightgreen; }")
            res.write(".Done { background-color: blue; }")
            res.write(".Dead { background-color: black; }")
            res.write(".Emergency { background-color: red; }")
            res.write(".Blocked { background-color: red; }")
            res.write("</style>")

            jsr.getEpicAndChildren(epicId)
            // jsr.getIssue(epicId)
            .then((e) => {
                debug(e.issues.length)
                debug(`processing ${e.issues[e.issues.length-1].key}...`)

                // for getEpicAndChildren(x), the Epic is always the last Issue in the issues list
                let epicData = e.issues.pop()

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
            
                // res.write(`<img class='${formatCssClassName(statusName)}' src='${epicData.fields.issuetype.iconUrl}' title='${epicData.key}: ${epicData.fields.summary} (${owner}; ${statusName})')/>\n`)
                res.write(`${epicData.key}: ${epicData.fields.summary}`)

                // Process children
                let results = { epic: [], stories: [], bugs: [], subtasks: [] }
                e.issues.forEach((issue, ndx) => {
                    debug(issue)
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
                        case "Sub-task":
                            results.subtasks.push(`<img class='${formatCssClassName(issue.fields.status.name)}' src='${issue.fields.issuetype.iconUrl}' title='${issue.key}: ${issue.fields.summary} (${owner}; ${statusName})')/>\n`)
                            debug(`Sub-task ${issue.key}...`)
                            break
                        case "Story":
                            results.stories.push(`<img class='${formatCssClassName(issue.fields.status.name)}' src='${issue.fields.issuetype.iconUrl}' title='${issue.key}: ${issue.fields.summary} (${owner}; ${statusName})')/>\n`)
                            debug(`Story ${issue.key}...`)
                            break
                        case "Bugs":
                            results.bugs.push(`<img class='${formatCssClassName(issue.fields.status.name)}' src='${issue.fields.issuetype.iconUrl}' title='${issue.key}: ${issue.fields.summary} (${owner}; ${statusName})')/>\n`)
                            debug(`Bug ${issue.key}...`)
                            break
                        default:
                            debug(`unrecognized issuetype: ${issue.fields.issuetype.name}`)
                    }
                })
                res.write(results.stories.join(''))
                res.write(results.subtasks.join(''))
                res.write(results.bugs.join(''))
            })
            .catch((err) => {
                debug(err)
                res.write(err)
                res.end()
                return
            })
            .finally(() => {
                res.end()
                return next()
            })
        })
        // res.end()
        // res.send(e)
        // return next()
    } else {
        res.redirect('/?error=epic%20not%20specified', next)
        return
    }
})

server.get('/chart', (req, res, next) => {
    let jsrCLM = jsr.getChartLinkMaker().reset()
    
    let dates = jdr.getDates()
    // Don't modify the original data
    // let series = JSON.parse(JSON.stringify(jdr.getSeriesData()))
    // n.b. es9 ... is much faster (10x) than JSON.parse/stringify
    let series = {...jdr.getSeriesData()}
    let statuses = Object.keys(series)
    
    let reZero = false
    let reZeroData = []

    try {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        jsrCLM.setCategories(dates)
        
        debug('...in /temp about to go through all statuses')
        debug(statuses)
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
        res.write(`<EM>Error</EM>: ${err}`)
        res.end()
        return next()
    }
})

server.get('/reset', (req, res, next) => {
    jdr.reset()
    jdr.processAllFiles()
    res.redirect('/chart', next)
    return
})

server.get('/datafiles', (req, res, next) => {
    // res.writeHead(200, { 'Content-Type': 'text/plain' })
    // res.send(jdr.getNewestFile())
    // jdr.processAllFiles()
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
