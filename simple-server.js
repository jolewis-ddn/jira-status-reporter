"use strict";
const debug = require('debug')('simple-server')
const restify = require('restify')
const restifyErrors = require('restify-errors')

const JSR = require('./JiraStatusReporter')
let jsr = new JSR();

const config = require('./config.js');

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
            doneKeys.push(data.key)
        })

        const statusChangesThisWeek = []
        values[6].issues.forEach((data) => {
            statusChangesThisWeek.push({key: data.key, type: data.fields.issuetype.name, owner: data.fields.assignee.displayName, updated: data.fields.updated, status: data.fields.status.name, summary: data.fields.summary })
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

var server = restify.createServer();
server.get('/', report);

server.listen(config.server.port, function() {
    console.log('%s listening at %s', server.name, server.url);
});

