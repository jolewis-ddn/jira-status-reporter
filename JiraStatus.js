const debug = require('debug')('JiraStatus')
const JSR = require('./JiraStatusReporter')
let jsr = new JSR()

const config = require('./config')

const faIcons = {
    Epic: 'fa:fa-fort-awesome',
    Story: 'fa:fa-book-reader',
    Task: 'fa:fa-tasks',
    'Sub-task': 'fa:fa-subscript',
    Bug: 'fa:fa-bug'
}

const useFontawesome = 'fa' in config() && config().fa

async function getFields() {
    debug(`getFields() called`)
    return await jsr.get('field')
}

async function formatFieldsHtml(fields) {
    let response = []
    response.push(`<table style="width: auto;" class="table table-striped table-hover table-sm"><thead class="thead-dark"><tr><th scope="col">${[
        'ID',
        'Name',
        'Custom',
        'Navigable',
        'Searchable',
        'Clause Names'
    ].join('</th><th scope="col">')}</th></tr></thead><tbody>`)
    response.push(`<em>${fields.length} fields as of ${new Date()}`)
    fields.forEach((f) => {
        response.push(
            `<tr><th scope="row">${f.id}</th><td>${[
                f.name,
                f.custom,
                f.navigable,
                f.searchable,
                f.clauseNames.join('<br>')
            ].join('</td><td>')}</td></tr>`
        )
    })
    response.push('</tbody></table>')
    return (response.join(''))
}

async function formatProjectDataHtml(projectData) {
    const types = ['epic', 'story', 'task', 'sub-task', 'bug']
    let response = []
    response.push(`<table style="width: auto;" class="table table-striped table-hover table-sm"><thead class="thead-dark"><tr><th scope="col">Project Name</th><th>${types.join('</th><th scope="col">')}</th></tr></thead><tbody>`)
    response.push(`<em>${Object.keys(projectData).length} projects as of ${new Date()}`)
    Object.keys(projectData).forEach((key) => {
        // debug(`projectData[${key}]`, projectData[key], projectData.key)
        response.push(
            `<tr><th scope="row">${key}</th><td>${projectData[key].counts.join('</td><td>')}</td></tr>`
        )
    })
    response.push('</tbody></table>')
    return (response.join(''))
}

function getFontawesomeJsLink() {
    if (useFontawesome) {
        return `<script src="${config().fa}" crossorigin="anonymous"></script>`
    } else {
        return ''
    }
}

function getFontawesomeIcon(issueType) {
    if (useFontawesome) {
        debug(`getFaIcon(${issueType}) returning ${faIcons[issueType]}`)
        return `${faIcons[issueType]} `
    } else {
        return ''
    }
}

function formatCssClassName(jiraName) {
    return jiraName.replace(/\s/g, '')
}

async function getConfig() {
    const cfg = config()
    cfg.jira.password = '***REMOVED***'
    return cfg
}

function formatConfigHtml(configDetails) {
    let response = []
    response.push(`
            <dl class="row">
            <dt class="col-sm-3">
            Jira Username
            </dt>
            <dd class="col-sm-9">
            ${config().jira.username}
            </dd>
            <dt class="col-sm-3">
            Jira URL
            </dt>
            <dd class="col-sm-9">
            ${config().jira.protocol}://${config().jira.host}
            </dd>
            <dt class="col-sm-3">
            API
            </dt>
            <dd class="col-sm-9">
            ${config().jira.apiVersion}
            </dd>
            <dt class="col-sm-3">
            Server: Port
            </dt>
            <dd class="col-sm-9">
            ${config().server.port.port}
            </dd>
            <dt class="col-sm-3">
            Graphic Server
            </dt>
            <dd class="col-sm-9">
            ${config().graphicServer.protocol}://${
        config().graphicServer.server
        }:${config().graphicServer.port}/${config().graphicServer.script}
            </dd>
            <dt class="col-sm-3">
            Project
            </dt>
            <dd class="col-sm-9">
            ${config().project}
            </dd>
            </dl>`)
    return(response.join(''))
}

async function report() {
    let response = []

    return new Promise((resolve, reject) => {
        Promise.all([
            jsr.countRedEpics(),
            jsr.countDeadIssues(),
            jsr.countOpenIssuesByProject(config().project),
            jsr.countIssuesDoneThisMonth(config().project),
            jsr.getIssuesDoneThisMonth(config().project),
            jsr.countIssuesChangedThisMonthByProjectAndStatus(config().project, 'Status'),
            jsr.getIssuesChangedThisWeekByProjectAndStatus(config().project, 'Status')
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
                    debug(`values[6] pushing ${data.key}`)
                    let assigneeName = ''
                    if (data.fields.assignee) {
                        assigneeName = data.fields.assignee.displayName
                    }
                    statusChangesThisWeek.push({
                        key: data.key,
                        type: data.fields.issuetype.name,
                        owner: assigneeName,
                        updated: data.fields.updated,
                        status: data.fields.status.name,
                        summary: data.fields.summary
                    })
                })

                response.push({
                    'Epic Count': values[0],
                    'Dead Issue Count': values[1],
                    'Open Issues (Count)': values[2],
                    'Issue Status updates this Month (Count)': values[5],
                    'Issue Status updates this Week (Count)': values[5],
                    'Issue Status updates this Week (List)': statusChangesThisWeek,
                    'Issues Done this Month (Count)': values[3],
                    'Issues Done this Month (List)': doneKeys.join(',')
                    // 'Issues Done this Month (Data)': values[4],
                })
                resolve(response)
            })
            .catch((err) => {
                reject(err)
            })
    })
}

function printList(data, key = false, numbered = false, format = "html", link = false, linkPrefix = false) {
    if (typeof data == typeof []) { // List of objects
        if (key) {
            let results = []
            results.push(numbered ? `<ol>` : `<ul>`)
            data.forEach(d => {
                let printedName = d[key]
                debug(printedName, numbered, format, link, linkPrefix)
                if (link) {
                    // Make the name a link
                    if (linkPrefix) {
                        printedName = `<a href='${link}/${linkPrefix}'>${d[key]}</a> [${name}]`
                    } else {
                        printedName = `<a href='${link}/${d[key]}'>${d.name}</a> [${d[key]}]`
                    }
                }
                results.push(`<li>${printedName}</li>`)
            })
            results.push(`</ul>`)
            return(results.join(''))
        } else {
            if (format == "html") {
                return(`${ numbered ? '<ol>' : '<ul>' }<li>${data.join('</li></li>')}</li></ul>`)
            } else {
                return(data.join(`\n`))
            }
        }
    } else {
        return('unknown data type')
    }
}

async function getProjects() {
    return(await jsr.getProjects(true))    
}

module.exports = {
    getConfig,
    getFields,
    formatConfigHtml,
    formatFieldsHtml,
    formatProjectDataHtml,
    useFontawesome,
    faIcons,
    getFontawesomeIcon,
    getFontawesomeJsLink,
    formatCssClassName,
    report,
    getProjects,
    printList
}
