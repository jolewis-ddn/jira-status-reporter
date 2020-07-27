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

server.get('/chart', (req, res, next) => {
    let jsrCLM = jsr.getChartLinkMaker().reset()
    
    let dates = jdr.getDates()
    let series = jdr.getSeriesData()
    let statuses = Object.keys(series)
    
    let reZero = false
    let reZeroData = []

    try {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        jsrCLM.setCategories(dates)
        
        debug('...in /temp about to go through all statuses')
        debug(statuses)
        // Reset statuses?
        if (req.query.reset) {
            debug(`reset = ${req.query.reset}`)
            reZero = req.query.reset
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
    // TODO: Doesn't fix chart reset...
    jdr.processAllFiles()
    res.redirect('/chart', next)
})

server.get('/datafiles', (req, res, next) => {
    // res.writeHead(200, { 'Content-Type': 'text/plain' })
    // res.send(jdr.getNewestFile())
    jdr.processAllFiles()
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

